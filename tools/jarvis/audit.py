#!/usr/bin/env python3
"""PG-backed audit logging for Jarvis agent loop."""
from __future__ import annotations

import json
import logging
from typing import Any

from tools.jarvis.jarvis_pg import get_pg_conn
from tools.jarvis.types import PlanStep, ToolResult

logger = logging.getLogger(__name__)


class AuditStore:
    """Write and query audit records to PostgreSQL."""

    TABLE = "jarvis_audit"

    def _ensure_table(self) -> None:
        ddl = f"""
        CREATE TABLE IF NOT EXISTS {self.TABLE} (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            step_id TEXT NOT NULL,
            tool TEXT NOT NULL,
            params JSONB,
            risk_level TEXT NOT NULL,
            approved BOOLEAN NOT NULL DEFAULT TRUE,
            safety_blocked BOOLEAN NOT NULL DEFAULT FALSE,
            success BOOLEAN NOT NULL DEFAULT FALSE,
            error TEXT,
            duration_ms REAL
        )
        """
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(ddl)
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{self.TABLE}_tool ON {self.TABLE}(tool, timestamp DESC)"
            )
            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{self.TABLE}_ts ON {self.TABLE}(timestamp DESC)"
            )
            cur.close()

    def write(
        self,
        step: PlanStep,
        result: ToolResult,
        approved: bool = True,
        safety_blocked: bool = False,
    ) -> None:
        """Persist a single audit record."""
        self._ensure_table()
        params_json = json.dumps(step.params, default=str) if step.params else None
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                f"""
                INSERT INTO {self.TABLE}
                (step_id, tool, params, risk_level, approved, safety_blocked, success, error, duration_ms)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    step.id,
                    step.tool_name,
                    params_json,
                    step.risk_level.value,
                    approved,
                    safety_blocked,
                    result.success,
                    result.error if result.error else None,
                    result.duration_ms,
                ),
            )
            cur.close()
        logger.debug("Audit record written for %s", step.tool_name)

    def query(
        self,
        tool: str | None = None,
        since: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Query audit records with optional filters."""
        self._ensure_table()
        clauses: list[str] = []
        args: list[Any] = []
        if tool:
            clauses.append("tool = %s")
            args.append(tool)
        if since:
            clauses.append("timestamp >= %s")
            args.append(since)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        sql = f"SELECT id, timestamp, step_id, tool, params, risk_level, approved, safety_blocked, success, error, duration_ms FROM {self.TABLE} {where} ORDER BY timestamp DESC LIMIT %s"
        args.append(limit)
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(sql, args)
            rows = cur.fetchall()
            cur.close()
        cols = [
            "id",
            "timestamp",
            "step_id",
            "tool",
            "params",
            "risk_level",
            "approved",
            "safety_blocked",
            "success",
            "error",
            "duration_ms",
        ]
        return [dict(zip(cols, row)) for row in rows]

    def purge(self, older_than_hours: int = 168) -> int:
        """Delete old audit records. Returns row count."""
        self._ensure_table()
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                f"DELETE FROM {self.TABLE} WHERE timestamp < NOW() - INTERVAL '%s hours'",
                (older_than_hours,),
            )
            count = cur.rowcount
            cur.close()
        logger.info("Purged %d audit records older than %s hours", count, older_than_hours)
        return count


def get_audit_store() -> AuditStore:
    """Factory returning a ready-to-use AuditStore."""
    return AuditStore()
