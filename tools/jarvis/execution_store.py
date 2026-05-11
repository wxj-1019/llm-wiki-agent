#!/usr/bin/env python3
"""Persistent storage for Jarvis goal execution history."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from tools.jarvis.jarvis_pg import get_pg_conn
from tools.jarvis.shared_utils import iso_now
from tools.jarvis.types import GoalRequest, PlanStep, ToolResult

REPO_ROOT = Path(__file__).parent.parent.parent

_INIT_SQL = """
CREATE TABLE IF NOT EXISTS jarvis_executions (
    session_id      TEXT PRIMARY KEY,
    goal            TEXT NOT NULL,
    strategy        TEXT NOT NULL DEFAULT 'balanced',
    status          TEXT NOT NULL DEFAULT 'running',
    steps_json      JSONB NOT NULL DEFAULT '[]',
    tool_calls_json JSONB NOT NULL DEFAULT '[]',
    reflections_json JSONB NOT NULL DEFAULT '[]',
    content         TEXT NOT NULL DEFAULT '',
    error           TEXT NOT NULL DEFAULT '',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jarvis_executions_time ON jarvis_executions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_jarvis_executions_status ON jarvis_executions (status, started_at DESC);
"""


def _ensure_table() -> None:
    with get_pg_conn() as conn:
        cur = conn.cursor()
        cur.execute(_INIT_SQL)
        conn.commit()
        cur.close()


class ExecutionStore:
    def __init__(self) -> None:
        _ensure_table()

    def create(self, goal_request: GoalRequest) -> None:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO jarvis_executions (session_id, goal, strategy, status, started_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (session_id) DO UPDATE SET
                    goal = EXCLUDED.goal,
                    strategy = EXCLUDED.strategy,
                    status = EXCLUDED.status,
                    started_at = EXCLUDED.started_at
                """,
                (
                    goal_request.session_id,
                    goal_request.description,
                    goal_request.strategy,
                    "running",
                    iso_now(),
                ),
            )
            conn.commit()
            cur.close()

    def update_steps(self, session_id: str, steps: list[PlanStep]) -> None:
        steps_data = []
        for s in steps:
            steps_data.append({
                "id": s.id,
                "tool_name": s.tool_name,
                "params": s.params,
                "status": s.status.value,
                "risk_level": s.risk_level.value,
                "result": s.result.to_dict() if s.result else None,
            })
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE jarvis_executions SET steps_json = %s WHERE session_id = %s",
                (json.dumps(steps_data), session_id),
            )
            conn.commit()
            cur.close()

    def update_tool_calls(self, session_id: str, tool_calls: list[dict]) -> None:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE jarvis_executions SET tool_calls_json = %s WHERE session_id = %s",
                (json.dumps(tool_calls), session_id),
            )
            conn.commit()
            cur.close()

    def update_reflections(self, session_id: str, reflections: list[dict]) -> None:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE jarvis_executions SET reflections_json = %s WHERE session_id = %s",
                (json.dumps(reflections), session_id),
            )
            conn.commit()
            cur.close()

    def finish(self, session_id: str, status: str, content: str, error: str) -> None:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE jarvis_executions
                SET status = %s, content = %s, error = %s, finished_at = %s
                WHERE session_id = %s
                """,
                (status, content, error, iso_now(), session_id),
            )
            conn.commit()
            cur.close()

    def list_recent(self, limit: int = 50) -> list[dict]:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT session_id, goal, strategy, status, steps_json, tool_calls_json,
                       reflections_json, content, error, started_at, finished_at
                FROM jarvis_executions
                ORDER BY started_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
            cur.close()

        cols = [
            "session_id", "goal", "strategy", "status", "steps", "tool_calls",
            "reflections", "content", "error", "started_at", "finished_at",
        ]
        result: list[dict] = []
        for row in rows:
            item = dict(zip(cols, row))
            for key in ("steps", "tool_calls", "reflections"):
                if isinstance(item.get(key), str):
                    item[key] = json.loads(item[key])
            result.append(item)
        return result

    def get_by_id(self, session_id: str) -> dict | None:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT session_id, goal, strategy, status, steps_json, tool_calls_json,
                       reflections_json, content, error, started_at, finished_at
                FROM jarvis_executions
                WHERE session_id = %s
                """,
                (session_id,),
            )
            row = cur.fetchone()
            cur.close()
        if row is None:
            return None
        cols = [
            "session_id", "goal", "strategy", "status", "steps", "tool_calls",
            "reflections", "content", "error", "started_at", "finished_at",
        ]
        item = dict(zip(cols, row))
        for key in ("steps", "tool_calls", "reflections"):
            if isinstance(item.get(key), str):
                item[key] = json.loads(item[key])
        return item


_store: ExecutionStore | None = None


def get_execution_store() -> ExecutionStore:
    global _store
    if _store is None:
        _store = ExecutionStore()
    return _store
