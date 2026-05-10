#!/usr/bin/env python3
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from tools.jarvis.types import ApprovalRequest, PlanStep, RiskLevel

REPO_ROOT = Path(__file__).parent.parent.parent

DEFAULT_AUTO_APPROVE_RULES: list[dict[str, Any]] = [
    {"tool": "git_commit", "pattern": "auto-fix:", "max_per_hour": 5},
    {"tool": "terminal_exec", "pattern": "npm run", "max_per_hour": 3},
    {"tool": "terminal_exec", "pattern": "python tools/health", "max_per_hour": 10},
]


class ApprovalManager:
    def __init__(self):
        self._state_dir = REPO_ROOT / "state"
        self._state_dir.mkdir(parents=True, exist_ok=True)
        self._db_path = self._state_dir / "jarvis_approvals.db"
        self._conn = sqlite3.connect(str(self._db_path))
        self._conn.row_factory = sqlite3.Row
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS approvals (
                id TEXT PRIMARY KEY,
                step_json TEXT NOT NULL,
                reason TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                resolved_at TEXT,
                resolved_by TEXT,
                auto_approved INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        self._conn.commit()
        self._policies = self._load_policies()

    def _load_policies(self) -> list[dict[str, Any]]:
        policy_path = REPO_ROOT / "config" / "approval_policies.yaml"
        if policy_path.exists():
            try:
                import yaml

                with open(policy_path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                if isinstance(data, list):
                    return data
                if isinstance(data, dict) and "rules" in data:
                    return data["rules"]
            except Exception:
                pass
        return DEFAULT_AUTO_APPROVE_RULES

    def submit(self, step: PlanStep, reason: str) -> ApprovalRequest:
        req_id = f"apr_{uuid.uuid4().hex[:8]}"
        req = ApprovalRequest(
            id=req_id,
            step=step,
            reason=reason,
            status="pending",
            created_at=datetime.now().isoformat(),
        )
        self._conn.execute(
            "INSERT INTO approvals (id, step_json, reason, status, created_at) VALUES (?, ?, ?, ?, ?)",
            (req.id, json.dumps(self._step_to_dict(step)), req.reason, req.status, req.created_at),
        )
        self._conn.commit()
        return req

    def approve(self, req_id: str, approver: str = "user") -> bool:
        now = datetime.now().isoformat()
        cursor = self._conn.execute(
            "UPDATE approvals SET status = 'approved', resolved_at = ?, resolved_by = ? WHERE id = ? AND status = 'pending'",
            (now, approver, req_id),
        )
        self._conn.commit()
        return cursor.rowcount > 0

    def reject(self, req_id: str, approver: str = "user") -> bool:
        now = datetime.now().isoformat()
        cursor = self._conn.execute(
            "UPDATE approvals SET status = 'rejected', resolved_at = ?, resolved_by = ? WHERE id = ? AND status = 'pending'",
            (now, approver, req_id),
        )
        self._conn.commit()
        return cursor.rowcount > 0

    def get_pending(self) -> list[ApprovalRequest]:
        rows = self._conn.execute(
            "SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at ASC"
        ).fetchall()
        return [self._row_to_request(r) for r in rows]

    def get_by_id(self, req_id: str) -> ApprovalRequest | None:
        row = self._conn.execute(
            "SELECT * FROM approvals WHERE id = ?", (req_id,)
        ).fetchone()
        if row is None:
            return None
        return self._row_to_request(row)

    def get_history(self, limit: int = 100) -> list[ApprovalRequest]:
        rows = self._conn.execute(
            "SELECT * FROM approvals WHERE status != 'pending' ORDER BY resolved_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [self._row_to_request(r) for r in rows]

    def auto_approve_check(self, step: PlanStep) -> bool:
        for rule in self._policies:
            tool = rule.get("tool", "")
            pattern = rule.get("pattern", "")
            max_per_hour = rule.get("max_per_hour", 0)
            if tool and step.tool_name == tool:
                check_value = ""
                if step.tool_name == "git_commit":
                    check_value = step.params.get("message", "")
                elif step.tool_name == "terminal_exec":
                    check_value = step.params.get("command", "")
                if check_value.startswith(pattern):
                    return self._check_rate(pattern, max_per_hour)
        return False

    def _check_rate(self, pattern: str, max_per_hour: int) -> bool:
        one_hour_ago = (datetime.now() - timedelta(hours=1)).isoformat()
        row = self._conn.execute(
            "SELECT COUNT(*) as cnt FROM approvals WHERE reason LIKE ? AND status = 'approved' AND auto_approved = 1 AND resolved_at >= ?",
            (f"%{pattern}%", one_hour_ago),
        ).fetchone()
        return row["cnt"] < max_per_hour

    def stats(self) -> dict[str, int]:
        rows = self._conn.execute(
            "SELECT status, COUNT(*) as cnt FROM approvals GROUP BY status"
        ).fetchall()
        result: dict[str, int] = {"pending": 0, "approved": 0, "rejected": 0}
        for r in rows:
            result[r["status"]] = r["cnt"]
        return result

    def _step_to_dict(self, step: PlanStep) -> dict:
        return {
            "id": step.id,
            "tool_name": step.tool_name,
            "params": step.params,
            "risk_level": step.risk_level.value,
            "requires_approval": step.requires_approval,
            "status": step.status.value,
        }

    def _row_to_request(self, row: sqlite3.Row) -> ApprovalRequest:
        step_data = json.loads(row["step_json"])
        step = PlanStep(
            id=step_data.get("id", ""),
            tool_name=step_data.get("tool_name", ""),
            params=step_data.get("params", {}),
            risk_level=RiskLevel(step_data.get("risk_level", "L1")),
            requires_approval=step_data.get("requires_approval", False),
        )
        return ApprovalRequest(
            id=row["id"],
            step=step,
            reason=row["reason"],
            status=row["status"],
            created_at=row["created_at"],
            resolved_at=row["resolved_at"] or "",
            resolved_by=row["resolved_by"] or "",
        )


_manager: ApprovalManager | None = None


def get_approval_manager() -> ApprovalManager:
    global _manager
    if _manager is None:
        _manager = ApprovalManager()
    return _manager
