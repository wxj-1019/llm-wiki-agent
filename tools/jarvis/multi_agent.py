#!/usr/bin/env python3
from __future__ import annotations

import json
import uuid
from tools.jarvis.shared_utils import iso_now
from pathlib import Path

from tools.jarvis.jarvis_pg import get_pg_conn
from tools.jarvis.types import Event, EventCategory, EventSource

try:
    from tools.jarvis.event_bus import get_event_bus
except ImportError:
    get_event_bus = None

REPO_ROOT = Path(__file__).parent.parent.parent

BUILTIN_ROLES: dict[str, dict] = {
    "researcher": {
        "description": "Finds and ingests new knowledge",
        "tools": ["web_search", "web_fetch", "ingest"],
    },
    "curator": {
        "description": "Maintains wiki quality",
        "tools": ["health_check", "lint", "heal", "quality_score"],
    },
    "analyst": {
        "description": "Analyzes patterns and generates insights",
        "tools": ["build_graph", "query"],
    },
    "watcher": {
        "description": "Monitors system health and alerts",
        "tools": ["health_check", "system_info"],
    },
}

ROLE_KEYWORDS: dict[str, list[str]] = {
    "researcher": [
        "search", "find", "ingest", "fetch", "download", "discover",
        "research", "lookup", "retrieve", "import", "read", "load",
        "document", "paper", "article", "source",
    ],
    "curator": [
        "quality", "lint", "health", "fix", "heal", "clean", "maintain",
        "broken", "orphan", "stub", "missing", "validate", "repair",
        "update", "refresh", "index",
    ],
    "analyst": [
        "analyze", "graph", "insight", "pattern", "trend", "query",
        "question", "summarize", "synthesize", "report", "statistics",
        "relationship", "connection",
    ],
    "watcher": [
        "monitor", "alert", "watch", "status", "system", "check",
        "health", "uptime", "performance", "metric", "dashboard",
        "notify", "warn",
    ],
}


def _row_to_agent(row: tuple) -> dict:
    return {
        "id": row[0],
        "name": row[1],
        "role": row[2],
        "description": row[3],
        "status": row[4],
        "created_at": row[5],
        "last_active": row[6],
        "tasks_completed": row[7],
        "tasks_failed": row[8],
    }


def _row_to_task(row: tuple) -> dict:
    return {
        "id": row[0],
        "agent_id": row[1],
        "task": row[2],
        "priority": row[3],
        "status": row[4],
        "created_at": row[5],
        "completed_at": row[6],
        "result_json": row[7],
    }


class MultiAgentManager:
    def __init__(self) -> None:
        pass

    def register_agent(self, name: str, role: str, description: str) -> dict:
        agent_id = f"agent_{uuid.uuid4().hex[:12]}"
        now = iso_now()

        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO jarvis_agents (id, name, role, description, status, created_at, last_active, tasks_completed, tasks_failed)
                VALUES (%s, %s, %s, %s, 'idle', %s, %s, 0, 0)
                """,
                (agent_id, name, role, description, now, now),
            )
            cur.close()

        self._publish_event("agent.registered", {"agent_id": agent_id, "name": name, "role": role})

        return {
            "id": agent_id,
            "name": name,
            "role": role,
            "description": description,
            "status": "idle",
            "created_at": now,
        }

    def unregister_agent(self, agent_id: str) -> bool:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, name FROM jarvis_agents WHERE id = %s",
                (agent_id,),
            )
            agent = cur.fetchone()

            if not agent:
                cur.close()
                return False

            agent_name = agent[1]

            cur.execute("DELETE FROM jarvis_tasks WHERE agent_id = %s", (agent_id,))
            cur.execute("DELETE FROM jarvis_agents WHERE id = %s", (agent_id,))
            cur.close()

        self._publish_event("agent.unregistered", {"agent_id": agent_id, "name": agent_name})

        return True

    def list_agents(self, status: str = "") -> list[dict]:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            if status:
                cur.execute(
                    "SELECT * FROM jarvis_agents WHERE status = %s ORDER BY created_at",
                    (status,),
                )
            else:
                cur.execute(
                    "SELECT * FROM jarvis_agents ORDER BY created_at",
                )
            rows = cur.fetchall()
            cur.close()
            return [_row_to_agent(r) for r in rows]

    def assign_task(self, agent_id: str, task: str, priority: str = "medium") -> dict:
        task_id = f"task_{uuid.uuid4().hex[:12]}"
        now = iso_now()

        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id FROM jarvis_agents WHERE id = %s",
                (agent_id,),
            )
            agent = cur.fetchone()

            if not agent:
                cur.close()
                return {"error": f"Agent {agent_id} not found"}

            cur.execute(
                """
                INSERT INTO jarvis_tasks (id, agent_id, task, priority, status, created_at, completed_at, result_json)
                VALUES (%s, %s, %s, %s, 'pending', %s, NULL, NULL)
                """,
                (task_id, agent_id, task, priority, now),
            )

            cur.execute(
                "UPDATE jarvis_agents SET last_active = %s, status = 'busy' WHERE id = %s",
                (now, agent_id),
            )
            cur.close()

        self._publish_event("task.assigned", {"task_id": task_id, "agent_id": agent_id, "task": task, "priority": priority})

        return {
            "id": task_id,
            "agent_id": agent_id,
            "task": task,
            "priority": priority,
            "status": "pending",
            "created_at": now,
        }

    def get_task(self, task_id: str) -> dict | None:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT * FROM jarvis_tasks WHERE id = %s",
                (task_id,),
            )
            row = cur.fetchone()
            cur.close()
            if row:
                return _row_to_task(row)
            return None

    def start_task(self, task_id: str) -> bool:
        now = iso_now()
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE jarvis_tasks SET status = 'running' WHERE id = %s AND status = 'pending'",
                (task_id,),
            )
            updated = cur.rowcount > 0
            cur.close()
        if updated:
            self._publish_event("task.started", {"task_id": task_id})
        return updated

    def complete_task(self, task_id: str, result: dict | None = None) -> bool:
        now = iso_now()
        result_json = json.dumps(result) if result else "{}"

        with get_pg_conn() as conn:
            cur = conn.cursor()
            # Get agent_id first
            cur.execute("SELECT agent_id FROM jarvis_tasks WHERE id = %s", (task_id,))
            row = cur.fetchone()
            if not row:
                cur.close()
                return False
            agent_id = row[0]

            cur.execute(
                """
                UPDATE jarvis_tasks
                SET status = 'completed', completed_at = %s, result_json = %s
                WHERE id = %s AND status IN ('pending', 'running')
                """,
                (now, result_json, task_id),
            )
            updated = cur.rowcount > 0

            if updated:
                cur.execute(
                    """
                    UPDATE jarvis_agents
                    SET tasks_completed = tasks_completed + 1, status = 'idle', last_active = %s
                    WHERE id = %s
                    """,
                    (now, agent_id),
                )
            cur.close()

        if updated:
            self._publish_event("task.completed", {"task_id": task_id, "agent_id": agent_id})
        return updated

    def fail_task(self, task_id: str, error: str = "") -> bool:
        now = iso_now()
        result_json = json.dumps({"error": error}) if error else "{}"

        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT agent_id FROM jarvis_tasks WHERE id = %s", (task_id,))
            row = cur.fetchone()
            if not row:
                cur.close()
                return False
            agent_id = row[0]

            cur.execute(
                """
                UPDATE jarvis_tasks
                SET status = 'failed', completed_at = %s, result_json = %s
                WHERE id = %s AND status IN ('pending', 'running')
                """,
                (now, result_json, task_id),
            )
            updated = cur.rowcount > 0

            if updated:
                cur.execute(
                    """
                    UPDATE jarvis_agents
                    SET tasks_failed = tasks_failed + 1, status = 'idle', last_active = %s
                    WHERE id = %s
                    """,
                    (now, agent_id),
                )
            cur.close()

        if updated:
            self._publish_event("task.failed", {"task_id": task_id, "agent_id": agent_id, "error": error})
        return updated

    def list_tasks(self, agent_id: str = "", status: str = "") -> list[dict]:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            query = "SELECT * FROM jarvis_tasks WHERE 1=1"
            params: list[str] = []

            if agent_id:
                query += " AND agent_id = %s"
                params.append(agent_id)
            if status:
                query += " AND status = %s"
                params.append(status)

            query += " ORDER BY created_at DESC"
            cur.execute(query, params)
            rows = cur.fetchall()
            cur.close()
            return [_row_to_task(r) for r in rows]

    def decompose_for_agents(self, goal: str) -> list[dict]:
        goal_lower = goal.lower()
        sub_tasks = self._split_goal(goal_lower)
        agents = self.list_agents()
        assigned: list[dict] = []

        if not agents:
            return assigned

        for sub_task in sub_tasks:
            best_agent = self._find_best_agent(agents, sub_task.lower())
            if best_agent:
                priority = self._infer_priority(sub_task.lower())
                result = self.assign_task(best_agent["id"], sub_task, priority)
                assigned.append(result)

        self._publish_event("goal.decomposed", {"goal": goal, "task_count": len(assigned)})

        return assigned

    def get_agent_status(self, agent_id: str) -> dict:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT * FROM jarvis_agents WHERE id = %s",
                (agent_id,),
            )
            agent = cur.fetchone()

            if not agent:
                cur.close()
                return {"error": f"Agent {agent_id} not found"}

            cur.execute(
                "SELECT COUNT(*) FROM jarvis_tasks WHERE agent_id = %s AND status = 'pending'",
                (agent_id,),
            )
            pending = cur.fetchone()

            cur.execute(
                "SELECT COUNT(*) FROM jarvis_tasks WHERE agent_id = %s AND status = 'running'",
                (agent_id,),
            )
            running = cur.fetchone()

            cur.execute(
                "SELECT * FROM jarvis_tasks WHERE agent_id = %s ORDER BY created_at DESC LIMIT 5",
                (agent_id,),
            )
            recent = cur.fetchall()
            cur.close()

        agent_dict = _row_to_agent(agent)
        total_tasks = agent_dict["tasks_completed"] + agent_dict["tasks_failed"]
        success_rate = (agent_dict["tasks_completed"] / total_tasks * 100) if total_tasks > 0 else 0.0

        return {
            "agent": agent_dict,
            "queue": {
                "pending": pending[0] if pending else 0,
                "running": running[0] if running else 0,
            },
            "success_rate": round(success_rate, 1),
            "recent_tasks": [_row_to_task(r) for r in recent],
        }

    def broadcast_message(self, message: str, category: str = "agent") -> None:
        try:
            cat = EventCategory(category)
        except ValueError:
            cat = EventCategory.AGENT

        self._publish_event("agent.broadcast", {"message": message}, category=cat)

    def get_coordination_summary(self) -> dict:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM jarvis_agents")
            agents = cur.fetchall()

            cur.execute(
                "SELECT COUNT(*) FROM jarvis_tasks WHERE status = 'pending'"
            )
            total_pending = cur.fetchone()

            cur.execute(
                "SELECT COUNT(*) FROM jarvis_tasks WHERE status = 'running'"
            )
            total_running = cur.fetchone()

            cur.execute(
                "SELECT COUNT(*) FROM jarvis_tasks WHERE status = 'completed'"
            )
            total_completed = cur.fetchone()

            cur.execute(
                "SELECT COUNT(*) FROM jarvis_tasks WHERE status = 'failed'"
            )
            total_failed = cur.fetchone()
            cur.close()

        agent_summaries = []
        for a in agents:
            a_dict = _row_to_agent(a)
            total = a_dict["tasks_completed"] + a_dict["tasks_failed"]
            rate = (a_dict["tasks_completed"] / total * 100) if total > 0 else 0.0
            agent_summaries.append({
                "id": a_dict["id"],
                "name": a_dict["name"],
                "role": a_dict["role"],
                "status": a_dict["status"],
                "tasks_completed": a_dict["tasks_completed"],
                "tasks_failed": a_dict["tasks_failed"],
                "success_rate": round(rate, 1),
            })

        return {
            "total_agents": len(agents),
            "agents": agent_summaries,
            "tasks": {
                "pending": total_pending[0] if total_pending else 0,
                "running": total_running[0] if total_running else 0,
                "completed": total_completed[0] if total_completed else 0,
                "failed": total_failed[0] if total_failed else 0,
            },
        }

    def _publish_event(self, name: str, payload: dict, category: EventCategory = EventCategory.AGENT) -> None:
        if get_event_bus is None:
            return
        try:
            bus = get_event_bus()
            bus.publish(Event(
                name=name,
                category=category,
                payload=payload,
                source=EventSource.MULTI_AGENT,
            ))
        except Exception:
            pass

    @staticmethod
    def _split_goal(goal: str) -> list[str]:
        separators = ["; ", ". then ", ", then ", " and ", "\n"]
        remaining = goal
        parts: list[str] = []

        for sep in separators:
            if sep in remaining:
                split = remaining.split(sep)
                parts = [s.strip() for s in split if s.strip()]
                break

        if not parts:
            parts = [goal.strip()]

        return parts

    @staticmethod
    def _find_best_agent(agents: list[dict], task_text: str) -> dict | None:
        best_agent: dict | None = None
        best_score = 0

        for agent in agents:
            role = agent.get("role", "")
            keywords = ROLE_KEYWORDS.get(role, [])
            score = sum(1 for kw in keywords if kw in task_text)

            role_info = BUILTIN_ROLES.get(role, {})
            tools = role_info.get("tools", [])
            score += sum(1 for t in tools if t in task_text) * 2

            if score > best_score:
                best_score = score
                best_agent = agent

        if best_agent is None and agents:
            best_agent = agents[0]

        return best_agent

    @staticmethod
    def _infer_priority(task_text: str) -> str:
        critical_words = ["urgent", "critical", "emergency", "immediately", "asap"]
        high_words = ["important", "high", "priority", "soon", "quickly"]
        low_words = ["later", "low", "optional", "background", "eventually", "whenever"]

        for w in critical_words:
            if w in task_text:
                return "critical"
        for w in high_words:
            if w in task_text:
                return "high"
        for w in low_words:
            if w in task_text:
                return "low"
        return "medium"


_manager: MultiAgentManager | None = None


def get_multi_agent_manager() -> MultiAgentManager:
    global _manager
    if _manager is None:
        _manager = MultiAgentManager()
    return _manager
