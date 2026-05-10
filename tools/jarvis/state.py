#!/usr/bin/env python3
"""PG-backed AgentState persistence."""
from __future__ import annotations

import json
import logging
from typing import Any

from tools.jarvis.jarvis_pg import get_pg_conn
from tools.jarvis.types import (
    AgentState,
    AgentStatus,
    ApprovalRequest,
    Insight,
    Plan,
    PlanStep,
    RiskLevel,
    StepStatus,
    ToolResult,
    Urgency,
)

logger = logging.getLogger(__name__)


def _plan_to_dict(plan: Plan | None) -> dict | None:
    if plan is None:
        return None
    return {
        "goal": plan.goal,
        "cycle_id": plan.cycle_id,
        "steps": [
            {
                "id": s.id,
                "tool_name": s.tool_name,
                "params": s.params,
                "risk_level": s.risk_level.value,
                "requires_approval": s.requires_approval,
                "status": s.status.value,
                "result": s.result.to_dict() if s.result else None,
            }
            for s in plan.steps
        ],
        "parallel_groups": plan.parallel_groups,
    }


def _plan_from_dict(data: dict | None) -> Plan | None:
    if data is None:
        return None
    plan = Plan(goal=data.get("goal", ""), cycle_id=data.get("cycle_id", ""))
    plan.parallel_groups = data.get("parallel_groups", [])
    for s in data.get("steps", []):
        step = PlanStep(
            tool_name=s["tool_name"],
            params=s.get("params", {}),
            risk_level=RiskLevel(s.get("risk_level", "L1")),
            requires_approval=s.get("requires_approval", False),
            status=StepStatus(s.get("status", "pending")),
            id=s.get("id", ""),
        )
        r = s.get("result")
        if r:
            step.result = ToolResult(
                success=r.get("success", False),
                data=r.get("data"),
                error=r.get("error", ""),
                duration_ms=r.get("duration_ms", 0.0),
                tokens_used=r.get("tokens_used", {}),
                retryable=r.get("retryable", False),
            )
        plan.add_step(step)
    return plan


def _approval_to_dict(req: ApprovalRequest) -> dict:
    return {
        "id": req.id,
        "step": {
            "id": req.step.id,
            "tool_name": req.step.tool_name,
            "params": req.step.params,
            "risk_level": req.step.risk_level.value,
            "requires_approval": req.step.requires_approval,
            "status": req.step.status.value,
            "result": req.step.result.to_dict() if req.step.result else None,
        },
        "reason": req.reason,
        "status": req.status,
        "created_at": req.created_at,
        "resolved_at": req.resolved_at,
        "resolved_by": req.resolved_by,
    }


def _approval_from_dict(data: dict) -> ApprovalRequest:
    s = data["step"]
    step = PlanStep(
        tool_name=s["tool_name"],
        params=s.get("params", {}),
        risk_level=RiskLevel(s.get("risk_level", "L1")),
        requires_approval=s.get("requires_approval", False),
        status=StepStatus(s.get("status", "pending")),
        id=s.get("id", ""),
    )
    r = s.get("result")
    if r:
        step.result = ToolResult(
            success=r.get("success", False),
            data=r.get("data"),
            error=r.get("error", ""),
            duration_ms=r.get("duration_ms", 0.0),
            tokens_used=r.get("tokens_used", {}),
            retryable=r.get("retryable", False),
        )
    return ApprovalRequest(
        id=data["id"],
        step=step,
        reason=data["reason"],
        status=data.get("status", "pending"),
        created_at=data.get("created_at", ""),
        resolved_at=data.get("resolved_at", ""),
        resolved_by=data.get("resolved_by", ""),
    )


def _insight_to_dict(insight: Insight) -> dict:
    return {
        "description": insight.description,
        "urgency": insight.urgency.value,
        "suggested_action": insight.suggested_action,
        "tool_calls": insight.tool_calls,
        "risk_level": insight.risk_level.value,
        "reasoning": insight.reasoning,
    }


def _insight_from_dict(data: dict) -> Insight:
    return Insight(
        description=data["description"],
        urgency=Urgency(data.get("urgency", "low")),
        suggested_action=data.get("suggested_action", ""),
        tool_calls=data.get("tool_calls", []),
        risk_level=RiskLevel(data.get("risk_level", "L1")),
        reasoning=data.get("reasoning", ""),
    )


class AgentStateStore:
    """Single-row PostgreSQL persistence for AgentState."""

    TABLE = "jarvis_state"
    ROW_ID = "singleton"

    def _ensure_table(self) -> None:
        ddl = f"""
        CREATE TABLE IF NOT EXISTS {self.TABLE} (
            id TEXT PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'stopped',
            cycle_count INTEGER NOT NULL DEFAULT 0,
            last_cycle_time TEXT NOT NULL DEFAULT '',
            total_tool_calls INTEGER NOT NULL DEFAULT 0,
            total_success INTEGER NOT NULL DEFAULT 0,
            total_failed INTEGER NOT NULL DEFAULT 0,
            current_plan_json JSONB,
            pending_approvals_json JSONB,
            insights_json JSONB,
            daily_stats_json JSONB,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(ddl)

    def save(self, state: AgentState) -> None:
        """Persist *state* to the single row, creating it if absent."""
        self._ensure_table()
        current_plan = json.dumps(_plan_to_dict(state.current_plan)) if state.current_plan else None
        approvals = json.dumps([_approval_to_dict(a) for a in state.pending_approvals]) if state.pending_approvals else None
        insights = json.dumps([_insight_to_dict(i) for i in state.insights]) if state.insights else None
        daily_stats = json.dumps(state.daily_stats) if state.daily_stats else None

        upsert = f"""
        INSERT INTO {self.TABLE} (
            id, status, cycle_count, last_cycle_time,
            total_tool_calls, total_success, total_failed,
            current_plan_json, pending_approvals_json, insights_json, daily_stats_json, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            cycle_count = EXCLUDED.cycle_count,
            last_cycle_time = EXCLUDED.last_cycle_time,
            total_tool_calls = EXCLUDED.total_tool_calls,
            total_success = EXCLUDED.total_success,
            total_failed = EXCLUDED.total_failed,
            current_plan_json = EXCLUDED.current_plan_json,
            pending_approvals_json = EXCLUDED.pending_approvals_json,
            insights_json = EXCLUDED.insights_json,
            daily_stats_json = EXCLUDED.daily_stats_json,
            updated_at = NOW()
        """
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                upsert,
                (
                    self.ROW_ID,
                    state.status.value,
                    state.cycle_count,
                    state.last_cycle_time,
                    state.total_tool_calls,
                    state.total_success,
                    state.total_failed,
                    current_plan,
                    approvals,
                    insights,
                    daily_stats,
                ),
            )
        logger.debug("AgentState saved to PG.")

    def load(self) -> AgentState:
        """Restore AgentState from the single row. Returns a fresh default if absent."""
        self._ensure_table()
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                f"SELECT status, cycle_count, last_cycle_time, total_tool_calls, total_success, total_failed, current_plan_json, pending_approvals_json, insights_json, daily_stats_json FROM {self.TABLE} WHERE id = %s",
                (self.ROW_ID,),
            )
            row = cur.fetchone()

        if row is None:
            return AgentState()

        (
            status,
            cycle_count,
            last_cycle_time,
            total_tool_calls,
            total_success,
            total_failed,
            current_plan_json,
            pending_approvals_json,
            insights_json,
            daily_stats_json,
        ) = row

        state = AgentState(
            status=AgentStatus(status),
            cycle_count=cycle_count or 0,
            last_cycle_time=last_cycle_time or "",
            total_tool_calls=total_tool_calls or 0,
            total_success=total_success or 0,
            total_failed=total_failed or 0,
            current_plan=_plan_from_dict(current_plan_json) if current_plan_json else None,
            pending_approvals=[_approval_from_dict(a) for a in pending_approvals_json] if pending_approvals_json else [],
            insights=[_insight_from_dict(i) for i in insights_json] if insights_json else [],
            daily_stats=dict(daily_stats_json) if daily_stats_json else {},
        )
        logger.debug("AgentState loaded from PG.")
        return state

    def reset(self) -> None:
        """Reset the persisted state to defaults (destructive)."""
        self._ensure_table()
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(f"DELETE FROM {self.TABLE} WHERE id = %s", (self.ROW_ID,))
        logger.info("AgentState reset in PG.")


def get_state_store() -> AgentStateStore:
    """Factory returning a ready-to-use AgentStateStore."""
    return AgentStateStore()
