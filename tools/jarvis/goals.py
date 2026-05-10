#!/usr/bin/env python3
from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path

from tools.jarvis.jarvis_pg import get_pg_conn
from tools.jarvis.types import Insight
from tools.shared.llm import call_llm

PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


class GoalsManager:
    def __init__(self):
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS jarvis_goals (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'pending',
                    priority TEXT NOT NULL DEFAULT 'medium',
                    progress REAL NOT NULL DEFAULT 0.0,
                    created_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL,
                    deadline TEXT NOT NULL DEFAULT '',
                    parent_goal_id TEXT NOT NULL DEFAULT '',
                    metrics_json JSONB NOT NULL DEFAULT '{}'
                )
                """
            )
            cur.close()

    def create_goal(
        self,
        title: str,
        description: str,
        priority: str = "medium",
        deadline: str = "",
        parent_goal_id: str = "",
    ) -> dict:
        now = datetime.now().isoformat()
        goal_id = f"goal_{uuid.uuid4().hex[:8]}"
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO jarvis_goals (id, title, description, status, priority, progress, created_at, updated_at, deadline, parent_goal_id, metrics_json)
                VALUES (%s, %s, %s, 'pending', %s, 0.0, %s, %s, %s, %s, %s)
                """,
                (goal_id, title, description, priority, now, now, deadline, parent_goal_id, json.dumps({})),
            )
            cur.execute("SELECT * FROM jarvis_goals WHERE id = %s", (goal_id,))
            row = cur.fetchone()
            cur.close()
        return self._row_to_dict(row)

    def update_progress(self, goal_id: str, progress: float) -> bool:
        progress = max(0.0, min(1.0, progress))
        now = datetime.now().isoformat()
        status = "completed" if progress >= 1.0 else None

        with get_pg_conn() as conn:
            cur = conn.cursor()
            if status:
                cur.execute(
                    "UPDATE jarvis_goals SET progress = %s, status = %s, updated_at = %s WHERE id = %s",
                    (progress, status, now, goal_id),
                )
            else:
                cur.execute(
                    "UPDATE jarvis_goals SET progress = %s, updated_at = %s WHERE id = %s",
                    (progress, now, goal_id),
                )
            rowcount = cur.rowcount
            cur.close()
        return rowcount > 0

    def complete_goal(self, goal_id: str) -> bool:
        now = datetime.now().isoformat()
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE jarvis_goals SET status = 'completed', progress = 1.0, updated_at = %s WHERE id = %s",
                (now, goal_id),
            )
            rowcount = cur.rowcount
            cur.close()
        return rowcount > 0

    def cancel_goal(self, goal_id: str) -> bool:
        now = datetime.now().isoformat()
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE jarvis_goals SET status = 'cancelled', updated_at = %s WHERE id = %s",
                (now, goal_id),
            )
            rowcount = cur.rowcount
            cur.close()
        return rowcount > 0

    def get_goal(self, goal_id: str) -> dict | None:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM jarvis_goals WHERE id = %s", (goal_id,))
            row = cur.fetchone()
            cur.close()
        if row is None:
            return None
        return self._row_to_dict(row)

    def list_goals(self, status: str = "", priority: str = "") -> list[dict]:
        query = "SELECT * FROM jarvis_goals WHERE 1=1"
        params: list[str] = []
        if status:
            query += " AND status = %s"
            params.append(status)
        if priority:
            query += " AND priority = %s"
            params.append(priority)
        query += " ORDER BY created_at DESC"
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(query, params)
            rows = cur.fetchall()
            cur.close()
        return [self._row_to_dict(r) for r in rows]

    def get_active_goals(self) -> list[dict]:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT * FROM jarvis_goals WHERE status IN ('pending', 'in_progress') ORDER BY created_at ASC"
            )
            rows = cur.fetchall()
            cur.close()
        goals = [self._row_to_dict(r) for r in rows]
        goals.sort(key=lambda g: PRIORITY_ORDER.get(g["priority"], 99))
        return goals

    def check_goal_relevance(self, insight: Insight) -> list[str]:
        active_goals = self.get_active_goals()
        if not active_goals:
            return []

        insight_text = f"{insight.description} {insight.suggested_action}".lower()
        insight_words = set(insight_text.split())

        matching_ids: list[str] = []
        for goal in active_goals:
            goal_text = f"{goal['title']} {goal['description']}".lower()
            goal_words = set(goal_text.split())
            overlap = insight_words & goal_words
            stop_words = {
                "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
                "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
                "being", "have", "has", "had", "do", "does", "did", "will", "would",
                "could", "should", "may", "might", "shall", "can", "this", "that",
                "these", "those", "it", "its", "not", "no", "if", "then", "than",
                "so", "as", "up", "out", "about", "into", "over", "after", "all",
            }
            meaningful_overlap = overlap - stop_words
            if meaningful_overlap:
                matching_ids.append(goal["id"])

        return matching_ids

    def generate_progress_report(self) -> dict:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM jarvis_goals")
            rows = cur.fetchall()
            cur.close()
        goals = [self._row_to_dict(r) for r in rows]

        total = len(goals)
        by_status: dict[str, int] = {}
        by_priority: dict[str, int] = {}
        completed_count = 0
        total_progress = 0.0

        for g in goals:
            by_status[g["status"]] = by_status.get(g["status"], 0) + 1
            by_priority[g["priority"]] = by_priority.get(g["priority"], 0) + 1
            if g["status"] == "completed":
                completed_count += 1
            total_progress += g["progress"]

        return {
            "total_goals": total,
            "by_status": by_status,
            "by_priority": by_priority,
            "completion_rate": (completed_count / total * 100) if total > 0 else 0.0,
            "average_progress": (total_progress / total * 100) if total > 0 else 0.0,
        }

    def decompose_goal(self, goal_id: str) -> list[dict]:
        goal = self.get_goal(goal_id)
        if goal is None:
            return []

        prompt = (
            "Break down the following goal into 3-5 actionable sub-tasks.\n"
            "Return ONLY a JSON array of objects, each with 'title' and 'description' fields.\n"
            "No other text.\n\n"
            f"Goal: {goal['title']}\n"
            f"Description: {goal['description']}\n"
            f"Priority: {goal['priority']}"
        )

        try:
            raw = call_llm(
                prompt=prompt,
                system="You are a task decomposition assistant. Return only valid JSON arrays.",
                max_tokens=2048,
            )
        except Exception:
            return []

        sub_tasks: list[dict] = []
        try:
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                first_newline = cleaned.index("\n")
                last_backtick = cleaned.rindex("```")
                cleaned = cleaned[first_newline + 1 : last_backtick].strip()
            parsed = json.loads(cleaned)
            if not isinstance(parsed, list):
                return []
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                title = item.get("title", "")
                description = item.get("description", "")
                if not title:
                    continue
                sub = self.create_goal(
                    title=title,
                    description=description,
                    priority=goal["priority"],
                    deadline=goal.get("deadline", ""),
                    parent_goal_id=goal_id,
                )
                sub_tasks.append(sub)
        except (json.JSONDecodeError, ValueError):
            pass

        return sub_tasks

    def _row_to_dict(self, row: tuple) -> dict:
        metrics = row[10]
        if isinstance(metrics, str):
            metrics = json.loads(metrics)
        return {
            "id": row[0],
            "title": row[1],
            "description": row[2],
            "status": row[3],
            "priority": row[4],
            "progress": row[5],
            "created_at": row[6],
            "updated_at": row[7],
            "deadline": row[8],
            "parent_goal_id": row[9],
            "metrics_json": metrics,
        }


_manager: GoalsManager | None = None


def get_goals_manager() -> GoalsManager:
    global _manager
    if _manager is None:
        _manager = GoalsManager()
    return _manager
