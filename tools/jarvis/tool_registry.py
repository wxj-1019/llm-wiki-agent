#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import logging
import time

from tools.jarvis.jarvis_pg import get_pg_conn
from tools.jarvis.types import RiskLevel, ToolDef, ToolResult

logger = logging.getLogger(__name__)


class ToolRegistry:
    TABLE = "jarvis_tool_stats"

    def __init__(self):
        self._tools: dict[str, ToolDef] = {}
        self._ensure_table()
        self._load_stats()

    def _ensure_table(self) -> None:
        ddl = f"""
        CREATE TABLE IF NOT EXISTS {self.TABLE} (
            tool_name TEXT PRIMARY KEY,
            call_count INTEGER NOT NULL DEFAULT 0,
            success_count INTEGER NOT NULL DEFAULT 0,
            fail_count INTEGER NOT NULL DEFAULT 0,
            avg_duration_ms REAL NOT NULL DEFAULT 0.0,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(ddl)
            cur.close()

    def _maybe_load_stats(self, name: str) -> None:
        tool = self._tools.get(name)
        if tool is None:
            return
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                f"SELECT call_count, success_count, fail_count, avg_duration_ms FROM {self.TABLE} WHERE tool_name = %s",
                (name,),
            )
            row = cur.fetchone()
            cur.close()
        if row is None:
            return
        call_count, success_count, fail_count, avg_duration_ms = row
        tool.call_count = call_count or 0
        tool.success_count = success_count or 0
        tool.fail_count = fail_count or 0
        tool.avg_duration_ms = avg_duration_ms or 0.0

    def _load_stats(self) -> None:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(f"SELECT tool_name, call_count, success_count, fail_count, avg_duration_ms FROM {self.TABLE}")
            rows = cur.fetchall()
            cur.close()
        for name, call_count, success_count, fail_count, avg_duration_ms in rows:
            tool = self._tools.get(name)
            if tool is None:
                continue
            tool.call_count = call_count or 0
            tool.success_count = success_count or 0
            tool.fail_count = fail_count or 0
            tool.avg_duration_ms = avg_duration_ms or 0.0

    def _persist_stats(self, name: str) -> None:
        tool = self._tools.get(name)
        if tool is None:
            return
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                f"""
                INSERT INTO {self.TABLE} (tool_name, call_count, success_count, fail_count, avg_duration_ms, updated_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                ON CONFLICT (tool_name) DO UPDATE SET
                    call_count = EXCLUDED.call_count,
                    success_count = EXCLUDED.success_count,
                    fail_count = EXCLUDED.fail_count,
                    avg_duration_ms = EXCLUDED.avg_duration_ms,
                    updated_at = NOW()
                """,
                (name, tool.call_count, tool.success_count, tool.fail_count, tool.avg_duration_ms),
            )
            cur.close()

    def register(
        self,
        name: str,
        fn,
        description: str,
        risk_level: RiskLevel,
        input_schema: dict = {},
        output_schema: dict = {},
        category: str = "general",
    ):
        self._tools[name] = ToolDef(
            name=name,
            fn=fn,
            description=description,
            risk_level=risk_level,
            input_schema=input_schema,
            output_schema=output_schema,
            category=category,
        )
        self._maybe_load_stats(name)

    def unregister(self, name: str):
        self._tools.pop(name, None)

    def get(self, name: str) -> ToolDef | None:
        return self._tools.get(name)

    def list_tools(self, category: str = "") -> list[ToolDef]:
        tools = list(self._tools.values())
        if category:
            tools = [t for t in tools if t.category == category]
        return tools

    def list_by_risk(self, level: RiskLevel) -> list[ToolDef]:
        return [t for t in self._tools.values() if t.risk_level == level]

    async def execute(self, name: str, params: dict) -> ToolResult:
        tool = self._tools.get(name)
        if tool is None:
            return ToolResult(
                success=False,
                error=f"Tool not found: {name}",
                retryable=False,
            )

        start = time.perf_counter()
        try:
            if asyncio.iscoroutinefunction(tool.fn):
                data = await tool.fn(**params)
            else:
                data = tool.fn(**params)
            duration_ms = (time.perf_counter() - start) * 1000
            self.update_stats(name, True, duration_ms)
            return ToolResult(
                success=True,
                data=data,
                duration_ms=duration_ms,
            )
        except Exception as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            self.update_stats(name, False, duration_ms)
            return ToolResult(
                success=False,
                error=str(exc),
                duration_ms=duration_ms,
                retryable=True,
            )

    def update_stats(self, name: str, success: bool, duration_ms: float):
        tool = self._tools.get(name)
        if tool is None:
            return
        tool.call_count += 1
        if success:
            tool.success_count += 1
        else:
            tool.fail_count += 1
        if tool.call_count == 1:
            tool.avg_duration_ms = duration_ms
        else:
            total = tool.avg_duration_ms * (tool.call_count - 1) + duration_ms
            tool.avg_duration_ms = total / tool.call_count
        self._persist_stats(name)

    def get_stats(self) -> dict:
        return {
            name: {
                "call_count": t.call_count,
                "success_count": t.success_count,
                "fail_count": t.fail_count,
                "avg_duration_ms": t.avg_duration_ms,
            }
            for name, t in self._tools.items()
        }

    def health_check(self) -> dict:
        results = {}
        for name, tool in self._tools.items():
            results[name] = {
                "callable": callable(tool.fn),
                "risk_level": tool.risk_level.value,
                "category": tool.category,
            }
        return results


_registry: ToolRegistry | None = None


def get_registry() -> ToolRegistry:
    global _registry
    if _registry is None:
        _registry = ToolRegistry()
    return _registry


def register_tool(
    name: str,
    description: str,
    risk_level: RiskLevel,
    input_schema: dict = {},
    output_schema: dict = {},
    category: str = "general",
):
    def decorator(fn):
        registry = get_registry()
        registry.register(
            name=name,
            fn=fn,
            description=description,
            risk_level=risk_level,
            input_schema=input_schema,
            output_schema=output_schema,
            category=category,
        )
        return fn

    return decorator
