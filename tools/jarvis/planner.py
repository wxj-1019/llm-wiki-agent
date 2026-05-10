#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

from tools.jarvis.tool_registry import get_registry
from tools.jarvis.types import (
    Insight,
    Plan,
    PlanStep,
    RiskLevel,
    StepStatus,
)
from tools.shared.llm import call_llm

REPO_ROOT = Path(__file__).parent.parent.parent

_RISK_ORDER = {
    RiskLevel.L0: 0,
    RiskLevel.L1: 1,
    RiskLevel.L2: 2,
    RiskLevel.L3: 3,
    RiskLevel.L4: 4,
}

_APPROVAL_THRESHOLD = _RISK_ORDER[RiskLevel.L3]


class Planner:
    def __init__(self):
        self._registry = get_registry()

    def create_plan_from_insights(self, insights: list[Insight], goal: str = "") -> Plan:
        plan = Plan(goal=goal)
        for insight in insights:
            for tc in insight.tool_calls:
                tool_name = tc.get("tool", tc.get("name", ""))
                params = tc.get("params", tc.get("arguments", {}))
                tool_def = self._registry.get(tool_name)
                if tool_def is None:
                    step = PlanStep(
                        tool_name=tool_name,
                        params=params,
                        risk_level=insight.risk_level,
                        requires_approval=True,
                    )
                    plan.add_step(step)
                    continue
                risk = tool_def.risk_level
                requires_approval = _RISK_ORDER.get(risk, 0) >= _APPROVAL_THRESHOLD
                step = PlanStep(
                    tool_name=tool_name,
                    params=params,
                    risk_level=risk,
                    requires_approval=requires_approval,
                )
                plan.add_step(step)
        return plan

    def create_plan_from_goal(self, goal: str, context: dict = {}) -> Plan:
        available_tools = self._registry.list_tools()
        tool_descriptions = []
        for t in available_tools:
            tool_descriptions.append({
                "name": t.name,
                "description": t.description,
                "risk_level": t.risk_level.value,
                "input_schema": t.input_schema,
            })
        context_block = ""
        if context:
            context_block = f"\nAdditional context:\n{json.dumps(context, indent=2, ensure_ascii=False)}\n"
        prompt = (
            "Decompose the following goal into a sequence of tool-calling steps.\n"
            "Return ONLY a JSON object with this structure:\n"
            '{"steps": [{"tool": "<tool_name>", "params": {<params>}, "reason": "<why>"}]}\n\n'
            f"Goal: {goal}\n"
            f"{context_block}\n"
            f"Available tools:\n{json.dumps(tool_descriptions, indent=2, ensure_ascii=False)}\n"
        )
        system = (
            "You are a planning engine. Output only valid JSON. "
            "Each step must use one of the listed tools. "
            "Use exact tool names and valid parameter keys from the input_schema."
        )
        raw = call_llm(prompt=prompt, system=system, max_tokens=4096)
        plan = Plan(goal=goal)
        try:
            start = raw.index("{")
            end = raw.rindex("}") + 1
            data = json.loads(raw[start:end])
        except (ValueError, json.JSONDecodeError):
            return plan
        for item in data.get("steps", []):
            tool_name = item.get("tool", "")
            params = item.get("params", {})
            tool_def = self._registry.get(tool_name)
            if tool_def is None:
                continue
            risk = tool_def.risk_level
            requires_approval = _RISK_ORDER.get(risk, 0) >= _APPROVAL_THRESHOLD
            step = PlanStep(
                tool_name=tool_name,
                params=params,
                risk_level=risk,
                requires_approval=requires_approval,
            )
            plan.add_step(step)
        return plan

    def optimize_plan(self, plan: Plan) -> Plan:
        seen = {}
        deduped_steps = []
        for step in plan.steps:
            key = (step.tool_name, json.dumps(step.params, sort_keys=True))
            if key in seen:
                continue
            seen[key] = step.id
            deduped_steps.append(step)
        plan.steps = deduped_steps

        low_risk = []
        high_risk = []
        for step in plan.steps:
            if _RISK_ORDER.get(step.risk_level, 0) < _APPROVAL_THRESHOLD:
                low_risk.append(step)
            else:
                high_risk.append(step)
        plan.steps = low_risk + high_risk

        parallel_groups = []
        current_group = []
        for step in plan.steps:
            if not step.requires_approval:
                current_group.append(step.id)
            else:
                if current_group:
                    if len(current_group) > 1:
                        parallel_groups.append(list(current_group))
                    current_group = []
        if current_group and len(current_group) > 1:
            parallel_groups.append(list(current_group))
        plan.parallel_groups = parallel_groups
        return plan

    def validate_plan(self, plan: Plan) -> list[str]:
        issues: list[str] = []
        for i, step in enumerate(plan.steps):
            tool_def = self._registry.get(step.tool_name)
            if tool_def is None:
                issues.append(f"Step {i} ({step.id}): unknown tool '{step.tool_name}'")
                continue
            if tool_def.input_schema:
                required_keys = tool_def.input_schema.get("required", [])
                for key in required_keys:
                    if key not in step.params:
                        issues.append(
                            f"Step {i} ({step.id}): missing required param '{key}' for tool '{step.tool_name}'"
                        )
        step_ids = [s.id for s in plan.steps]
        id_counts = {}
        for sid in step_ids:
            id_counts[sid] = id_counts.get(sid, 0) + 1
        for sid, count in id_counts.items():
            if count > 1:
                issues.append(f"Duplicate step id: '{sid}' appears {count} times")
        return issues

    def estimate_cost(self, plan: Plan) -> dict:
        total_steps = len(plan.steps)
        l3_count = 0
        estimated_duration_ms = 0.0
        risk_counts = {}
        for step in plan.steps:
            risk_val = step.risk_level.value
            risk_counts[risk_val] = risk_counts.get(risk_val, 0) + 1
            if _RISK_ORDER.get(step.risk_level, 0) >= _APPROVAL_THRESHOLD:
                l3_count += 1
            tool_def = self._registry.get(step.tool_name)
            if tool_def and tool_def.avg_duration_ms > 0:
                estimated_duration_ms += tool_def.avg_duration_ms
            else:
                estimated_duration_ms += 1000.0
        risk_summary = ", ".join(
            f"{level}: {count}" for level, count in sorted(risk_counts.items())
        )
        return {
            "total_steps": total_steps,
            "l3_count": l3_count,
            "estimated_duration_ms": round(estimated_duration_ms, 1),
            "risk_summary": risk_summary,
        }

    def plan_to_text(self, plan: Plan) -> str:
        lines = []
        lines.append(f"Plan: {plan.goal}" if plan.goal else "Plan")
        lines.append(f"Steps: {len(plan.steps)}")
        if plan.parallel_groups:
            lines.append(f"Parallel groups: {len(plan.parallel_groups)}")
        lines.append("-" * 60)
        for i, step in enumerate(plan.steps, 1):
            status_icon = {
                StepStatus.PENDING: "[ ]",
                StepStatus.RUNNING: "[~]",
                StepStatus.COMPLETED: "[✓]",
                StepStatus.FAILED: "[✗]",
                StepStatus.SKIPPED: "[-]",
                StepStatus.AWAITING_APPROVAL: "[?]",
            }.get(step.status, "[ ]")
            approval_flag = " (needs approval)" if step.requires_approval else ""
            lines.append(
                f"  {i}. {status_icon} {step.tool_name} "
                f"| risk={step.risk_level.value}{approval_flag}"
            )
            if step.params:
                param_str = json.dumps(step.params, ensure_ascii=False)
                if len(param_str) > 80:
                    param_str = param_str[:77] + "..."
                lines.append(f"     params: {param_str}")
        lines.append("-" * 60)
        return "\n".join(lines)


_planner: Planner | None = None


def get_planner() -> Planner:
    global _planner
    if _planner is None:
        _planner = Planner()
    return _planner
