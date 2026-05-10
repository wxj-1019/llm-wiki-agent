#!/usr/bin/env python3
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from tools.jarvis.jarvis_pg import get_pg_conn
from tools.jarvis.types import ApprovalRequest, PlanStep, RiskLevel

REPO_ROOT = Path(__file__).parent.parent.parent

DEFAULT_AUTO_APPROVE_RULES: list[dict[str, Any]] = [
    {"tool": "git_commit", "pattern": "auto-fix:", "max_per_hour": 5},
    {"tool": "terminal_exec", "pattern": "npm run", "max_per_hour": 3},
    {"tool": "terminal_exec", "pattern": "python tools/health", "max_per_hour": 10},
]


class ApprovalManager:
    def __init__(self):
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
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO jarvis_approvals (id, step_json, reason, status, created_at)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (req.id, json.dumps(self._step_to_dict(step)), req.reason, req.status, req.created_at),
            )
            cur.close()
        return req

    def approve(self, req_id: str, approver: str = "user") -> bool:
        now = datetime.now().isoformat()
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE jarvis_approvals
                SET status = 'approved', resolved_at = %s, resolved_by = %s
                WHERE id = %s AND status = 'pending'
                """,
                (now, approver, req_id),
            )
            rowcount = cur.rowcount
            cur.close()
        return rowcount > 0

    def reject(self, req_id: str, approver: str = "user") -> bool:
        now = datetime.now().isoformat()
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE jarvis_approvals
                SET status = 'rejected', resolved_at = %s, resolved_by = %s
                WHERE id = %s AND status = 'pending'
                """,
                (now, approver, req_id),
            )
            rowcount = cur.rowcount
            cur.close()
        return rowcount > 0

    def get_pending(self) -> list[ApprovalRequest]:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, step_json, reason, status, created_at, resolved_at, resolved_by, auto_approved FROM jarvis_approvals WHERE status = 'pending' ORDER BY created_at ASC"
            )
            rows = cur.fetchall()
            cur.close()
        return [self._row_to_request(r) for r in rows]

    def get_by_id(self, req_id: str) -> ApprovalRequest | None:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, step_json, reason, status, created_at, resolved_at, resolved_by, auto_approved FROM jarvis_approvals WHERE id = %s",
                (req_id,),
            )
            row = cur.fetchone()
            cur.close()
        if row is None:
            return None
        return self._row_to_request(row)

    def get_history(self, limit: int = 100) -> list[ApprovalRequest]:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, step_json, reason, status, created_at, resolved_at, resolved_by, auto_approved FROM jarvis_approvals WHERE status != 'pending' ORDER BY resolved_at DESC LIMIT %s",
                (limit,),
            )
            rows = cur.fetchall()
            cur.close()
        return [self._row_to_request(r) for r in rows]

    def list_all(self, limit: int = 100) -> list[ApprovalRequest]:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, step_json, reason, status, created_at, resolved_at, resolved_by, auto_approved FROM jarvis_approvals ORDER BY created_at DESC LIMIT %s",
                (limit,),
            )
            rows = cur.fetchall()
            cur.close()
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
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT COUNT(*) FROM jarvis_approvals
                WHERE reason LIKE %s AND status = 'approved' AND auto_approved = TRUE AND resolved_at >= %s
                """,
                (f"%{pattern}%", one_hour_ago),
            )
            count = cur.fetchone()[0]
            cur.close()
        return count < max_per_hour

    def stats(self) -> dict[str, int]:
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT status, COUNT(*) FROM jarvis_approvals GROUP BY status")
            rows = cur.fetchall()
            cur.close()
        result: dict[str, int] = {"pending": 0, "approved": 0, "rejected": 0}
        for r in rows:
            result[r[0]] = r[1]
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

    def _row_to_request(self, row: tuple) -> ApprovalRequest:
        # row order: id, step_json, reason, status, created_at, resolved_at, resolved_by, auto_approved
        step_data = row[1]
        if isinstance(step_data, str):
            step_data = json.loads(step_data)
        step = PlanStep(
            id=step_data.get("id", ""),
            tool_name=step_data.get("tool_name", ""),
            params=step_data.get("params", {}),
            risk_level=RiskLevel(step_data.get("risk_level", "L1")),
            requires_approval=step_data.get("requires_approval", False),
        )
        return ApprovalRequest(
            id=row[0],
            step=step,
            reason=row[2],
            status=row[3],
            created_at=row[4],
            resolved_at=row[5] or "",
            resolved_by=row[6] or "",
        )


_manager: ApprovalManager | None = None


def get_approval_manager() -> ApprovalManager:
    global _manager
    if _manager is None:
        _manager = ApprovalManager()
    return _manager
