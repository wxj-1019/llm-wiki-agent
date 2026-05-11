#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Callable, Awaitable

from tools.jarvis.event_bus import get_event_bus
from tools.jarvis.tool_registry import get_registry
from tools.jarvis.safety import get_safety_engine
from tools.jarvis.approval import get_approval_manager
from tools.jarvis.state import get_state_store, AgentStateStore
from tools.jarvis.audit import get_audit_store, AuditStore
from tools.jarvis.types import (
    AgentState,
    AgentStatus,
    Event,
    EventCategory,
    Insight,
    Plan,
    PlanStep,
    StepStatus,
    ToolResult,
    Urgency,
    RiskLevel,
    ApprovalRequest,
    GoalRequest,
    SSEEvent,
)
from tools.shared.llm import call_llm

REPO_ROOT = Path(__file__).parent.parent.parent


class AgentLoop:
    def __init__(self) -> None:
        self._state_store = get_state_store()
        self._audit_store = get_audit_store()
        self.state = self._state_store.load()
        self.event_bus = get_event_bus()
        self.registry = get_registry()
        self.safety_engine = get_safety_engine()
        self.approval_manager = get_approval_manager()
        self.config = self._load_config()
        self._last_health_check: str = ""
        self._last_quality_check: str = ""
        self._last_budget_check: str = ""
        self._health_interval_hours: int = 1
        self._quality_interval_hours: int = 6
        self._budget_interval_hours: int = 1
        self._approval_events: dict[str, asyncio.Event] = {}
        self._approval_results: dict[str, bool] = {}

    async def run_cycle(self) -> str:
        cycle_id = f"cycle_{uuid.uuid4().hex[:8]}"
        self.state.cycle_count += 1
        self.state.last_cycle_time = datetime.now().isoformat()

        events = await self.perceive()
        if events:
            self.event_bus.mark_consumed([e.id for e in events])
        insights = await self.reason(events)
        self.state.insights = insights

        plan = await self.plan(insights)
        plan.cycle_id = cycle_id
        self.state.current_plan = plan

        results = await self.execute(plan)
        await self.learn(results)
        self._state_store.save(self.state)

        return cycle_id

    async def run_goal(
        self,
        goal_request: GoalRequest,
        sse_callback: Callable[[SSEEvent], Awaitable[None]] | None = None,
    ) -> str:
        """Run a single user-defined goal and stream progress via SSE."""
        session_id = goal_request.session_id

        async def _emit(event_type: str, data: dict) -> None:
            if sse_callback:
                await sse_callback(SSEEvent(type=event_type, data=data, session_id=session_id))

        try:
            # 1. Build plan from goal
            plan = await self._build_plan_for_goal(goal_request)
            await _emit("plan", {
                "session_id": session_id,
                "goal": goal_request.description,
                "strategy": goal_request.strategy,
                "steps": [{"id": s.id, "tool_name": s.tool_name, "params": s.params, "status": s.status.value} for s in plan.steps],
            })

            # 2. Execute each step
            results: list[ToolResult] = []
            for step in plan.steps:
                await _emit("step_start", {"step_id": step.id, "tool_name": step.tool_name, "params": step.params})

                if step.requires_approval:
                    auto_approved = self.approval_manager.auto_approve_check(step)
                    if not auto_approved:
                        req = self.approval_manager.submit(step, f"Tool '{step.tool_name}' requires approval (risk={step.risk_level.value})")
                        await _emit("approval_required", {
                            "req_id": req.id,
                            "step_id": step.id,
                            "tool_name": step.tool_name,
                            "params": step.params,
                            "risk_level": step.risk_level.value,
                            "reason": req.reason,
                        })

                        # Wait for frontend approval (30s timeout)
                        event = asyncio.Event()
                        self._approval_events[req.id] = event
                        try:
                            await asyncio.wait_for(event.wait(), timeout=30.0)
                            approved = self._approval_results.pop(req.id, False)
                        except asyncio.TimeoutError:
                            approved = False
                            self.approval_manager.reject(req.id, approver="system_timeout")
                            await _emit("tool_result", {
                                "step_id": step.id,
                                "tool_name": step.tool_name,
                                "success": False,
                                "error": "Approval timed out (30s)",
                            })
                        finally:
                            self._approval_events.pop(req.id, None)

                        if not approved:
                            step.status = StepStatus.SKIPPED
                            step.result = ToolResult(success=False, error="Approval denied or timed out", retryable=False)
                            results.append(step.result)
                            continue

                        # Approval granted - continue to execute below

                safety_result = self.safety_engine.pre_check(step)
                if not safety_result.passed:
                    step.status = StepStatus.SKIPPED
                    step.result = ToolResult(success=False, error=f"Safety check failed: {safety_result.reason}", retryable=False)
                    results.append(step.result)
                    await _emit("tool_result", {"step_id": step.id, "tool_name": step.tool_name, "success": False, "error": step.result.error})
                    continue

                await _emit("tool_call", {"step_id": step.id, "tool_name": step.tool_name, "params": step.params, "status": "running"})
                result = await self.registry.execute(step.tool_name, step.params)
                step.result = result

                if result.success:
                    step.status = StepStatus.COMPLETED
                else:
                    step.status = StepStatus.FAILED

                results.append(result)
                await _emit("tool_result", {
                    "step_id": step.id,
                    "tool_name": step.tool_name,
                    "success": result.success,
                    "data": result.data,
                    "error": result.error,
                    "duration_ms": result.duration_ms,
                })

            # 3. Reflection every 3 steps
            if len(plan.steps) >= 3:
                reflection = await self._reflect_on_results(plan, results)
                await _emit("reflection", {"session_id": session_id, "text": reflection})

            # 4. Final content/summary
            summary = await self._summarize_results(plan, results)
            await _emit("content", {"session_id": session_id, "text": summary})
            await _emit("done", {"session_id": session_id, "step_count": len(plan.steps), "success_count": sum(1 for r in results if r.success)})

            return summary

        except Exception as exc:
            await _emit("error", {"session_id": session_id, "error": str(exc)})
            raise

    async def _build_plan_for_goal(self, goal_request: GoalRequest) -> Plan:
        """Use LLM to break a user goal into a plan with tool calls."""
        registry = self.registry
        tool_descriptions = []
        for tool in registry.list_tools():
            tool_descriptions.append(f"- {tool.name}: {tool.description} (risk={tool.risk_level.value}, category={tool.category})")

        prompt = (
            f"You are Jarvis, an autonomous knowledge management assistant.\n"
            f"The user has given you the following goal:\n\n"
            f'"""{goal_request.description}"""\n\n'
            f"Strategy: {goal_request.strategy}\n\n"
            f"Available tools:\n" + "\n".join(tool_descriptions) + "\n\n"
            f"Break this goal into a sequence of tool calls. Return ONLY a JSON array of step objects, each with:\n"
            f"- tool_name: string (must match an available tool)\n"
            f"- params: object (parameters for the tool)\n"
            f"- reasoning: string (why this step is needed)\n\n"
            f"Return ONLY the JSON array, no other text."
        )

        raw = call_llm(prompt=prompt, system="You are a planning assistant for Jarvis.", max_tokens=4096)
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            first_newline = cleaned.index("\n")
            last_backtick = cleaned.rindex("```")
            cleaned = cleaned[first_newline + 1 : last_backtick].strip()

        steps_data = json.loads(cleaned)
        if not isinstance(steps_data, list):
            steps_data = [steps_data]

        plan = Plan(goal=goal_request.description)
        for item in steps_data:
            tool_name = item.get("tool_name", "")
            params = item.get("params", {})
            registered = registry.get(tool_name)
            risk = registered.risk_level if registered else RiskLevel.L1
            requires_approval = risk in (RiskLevel.L3, RiskLevel.L4)
            step = PlanStep(
                tool_name=tool_name,
                params=params if isinstance(params, dict) else {},
                risk_level=risk,
                requires_approval=requires_approval,
            )
            plan.add_step(step)
        return plan

    async def _reflect_on_results(self, plan: Plan, results: list[ToolResult]) -> str:
        """Generate a reflection on the execution results."""
        step_summaries = []
        for step, result in zip(plan.steps, results):
            status = "success" if result.success else "failed"
            step_summaries.append(f"- {step.tool_name}: {status} ({result.error if result.error else 'OK'})")

        prompt = (
            f"Reflect on the following execution results:\n\n"
            f"Goal: {plan.goal}\n"
            f"Steps:\n" + "\n".join(step_summaries) + "\n\n"
            f"Provide a brief reflection (1-2 sentences) on what went well, what failed, and what could be improved."
        )
        try:
            return call_llm(prompt=prompt, system="You are Jarvis reflecting on task execution.", max_tokens=512)
        except Exception:
            return "Reflection unavailable."

    async def _summarize_results(self, plan: Plan, results: list[ToolResult]) -> str:
        """Generate a final summary of the execution."""
        success_count = sum(1 for r in results if r.success)
        fail_count = len(results) - success_count
        data_outputs = [str(r.data) for r in results if r.data and r.success]

        prompt = (
            f"Summarize the results of the following task execution for the user:\n\n"
            f"Goal: {plan.goal}\n"
            f"Success: {success_count}/{len(results)} steps\n"
            f"Failed: {fail_count}/{len(results)} steps\n"
            f"Outputs:\n" + "\n".join(data_outputs[:10]) + "\n\n"
            f"Provide a concise summary (2-4 sentences) of what was accomplished."
        )
        try:
            return call_llm(prompt=prompt, system="You are Jarvis summarizing task results.", max_tokens=1024)
        except Exception:
            return f"Task completed with {success_count}/{len(results)} successful steps."

    async def perceive(self) -> list[Event]:
        events: list[Event] = []

        polled = self.event_bus.poll(limit=50)
        events.extend(polled)

        now = datetime.now().isoformat()

        if not self._last_health_check or self._hours_since(self._last_health_check) >= self._health_interval_hours:
            health_event = Event(
                name="agent.health.check_due",
                category=EventCategory.SYSTEM,
                payload={"trigger": "interval"},
                source="loop",
            )
            events.append(health_event)
            self._last_health_check = now

        if not self._last_quality_check or self._hours_since(self._last_quality_check) >= self._quality_interval_hours:
            quality_event = Event(
                name="agent.quality.check_due",
                category=EventCategory.SYSTEM,
                payload={"trigger": "interval"},
                source="loop",
            )
            events.append(quality_event)
            self._last_quality_check = now

        if not self._last_budget_check or self._hours_since(self._last_budget_check) >= self._budget_interval_hours:
            budget_event = Event(
                name="agent.budget.check_due",
                category=EventCategory.SYSTEM,
                payload={"trigger": "interval"},
                source="loop",
            )
            events.append(budget_event)
            self._last_budget_check = now

        return events

    async def reason(self, events: list[Event]) -> list[Insight]:
        if not events:
            return []

        event_descriptions: list[str] = []
        for evt in events:
            payload_str = json.dumps(evt.payload, default=str) if evt.payload else "{}"
            event_descriptions.append(
                f"- [{evt.category.value}] {evt.name} (id={evt.id}, time={evt.timestamp}, source={evt.source})\n  payload: {payload_str}"
            )

        system_status = self._system_status_str()

        prompt = (
            "Analyze the following events and system status, then return a JSON array of insights.\n"
            "Each insight must be a JSON object with these fields:\n"
            "- description: string, what was observed\n"
            "- urgency: one of [critical, high, medium, low]\n"
            "- suggested_action: string, what should be done\n"
            "- tool_calls: array of objects with 'tool' (string) and 'params' (object) fields\n"
            "- risk_level: one of [L0, L1, L2, L3, L4]\n"
            "- reasoning: string, why this insight matters\n\n"
            "Return ONLY the JSON array, no other text.\n\n"
            f"System status:\n{system_status}\n\n"
            f"Events ({len(events)} total):\n" + "\n".join(event_descriptions)
        )

        try:
            raw = call_llm(
                prompt=prompt,
                system="You are Jarvis, an autonomous knowledge management assistant. You analyze events and produce actionable insights as structured JSON.",
                max_tokens=4096,
            )
        except Exception:
            return []

        insights: list[Insight] = []
        try:
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                first_newline = cleaned.index("\n")
                last_backtick = cleaned.rindex("```")
                cleaned = cleaned[first_newline + 1 : last_backtick].strip()
            parsed = json.loads(cleaned)
            if not isinstance(parsed, list):
                parsed = [parsed]
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                urgency_str = item.get("urgency", "low")
                try:
                    urgency = Urgency(urgency_str)
                except ValueError:
                    urgency = Urgency.LOW
                risk_str = item.get("risk_level", "L1")
                try:
                    risk = RiskLevel(risk_str)
                except ValueError:
                    risk = RiskLevel.L1
                insight = Insight(
                    description=item.get("description", ""),
                    urgency=urgency,
                    suggested_action=item.get("suggested_action", ""),
                    tool_calls=item.get("tool_calls", []),
                    risk_level=risk,
                    reasoning=item.get("reasoning", ""),
                )
                insights.append(insight)
        except (json.JSONDecodeError, ValueError):
            pass

        return insights

    async def plan(self, insights: list[Insight]) -> Plan:
        plan = Plan(goal="Process insights from current cycle")

        for insight in insights:
            for call_spec in insight.tool_calls:
                tool_name = call_spec.get("tool", "")
                params = call_spec.get("params", {})
                if not tool_name:
                    continue

                registered = self.registry.get(tool_name)
                if registered is None:
                    continue

                risk = registered.risk_level
                requires_approval = risk in (RiskLevel.L3, RiskLevel.L4)

                step = PlanStep(
                    tool_name=tool_name,
                    params=params if isinstance(params, dict) else {},
                    risk_level=risk,
                    requires_approval=requires_approval,
                )
                plan.add_step(step)

            if not insight.tool_calls:
                risk = insight.risk_level
                requires_approval = risk in (RiskLevel.L3, RiskLevel.L4)
                step = PlanStep(
                    tool_name="noop",
                    params={"action": insight.suggested_action},
                    risk_level=risk,
                    requires_approval=requires_approval,
                )
                plan.add_step(step)

        return plan

    async def execute(self, plan: Plan) -> list[ToolResult]:
        results: list[ToolResult] = []

        for step in plan.steps:
            step.status = StepStatus.RUNNING

            if step.requires_approval:
                auto_approved = self.approval_manager.auto_approve_check(step)
                if not auto_approved:
                    req = ApprovalRequest(
                        id=f"apr_{uuid.uuid4().hex[:8]}",
                        step=step,
                        reason=f"Tool '{step.tool_name}' requires approval (risk={step.risk_level.value})",
                    )
                    self.state.pending_approvals.append(req)
                    self.approval_manager.submit(step, req.reason)
                    step.status = StepStatus.AWAITING_APPROVAL
                    step.result = ToolResult(success=False, error="Awaiting approval", retryable=False)
                    results.append(step.result)
                    self._audit_store.write(step, step.result, approved=False)
                    continue

            safety_result = self.safety_engine.pre_check(step)
            if not safety_result.passed:
                step.status = StepStatus.SKIPPED
                step.result = ToolResult(
                    success=False,
                    error=f"Safety check failed: {safety_result.reason}",
                    retryable=False,
                )
                results.append(step.result)
                self._audit_store.write(step, step.result, safety_blocked=True)
                continue

            self.safety_engine.record_call()
            result = await self.registry.execute(step.tool_name, step.params)
            # Track approximate cost for safety budget
            if result.tokens_used:
                inp = result.tokens_used.get("input", 0)
                out = result.tokens_used.get("output", 0)
                cost = (inp * 0.0000015) + (out * 0.000002)
                self.safety_engine.record_cost(cost)
            step.result = result

            if result.success:
                step.status = StepStatus.COMPLETED
                self.state.total_success += 1
            else:
                step.status = StepStatus.FAILED
                self.state.total_failed += 1

            self.state.total_tool_calls += 1
            results.append(result)
            self._audit_store.write(step, result)

        return results

    async def learn(self, results: list[ToolResult]) -> None:
        success_count = sum(1 for r in results if r.success)
        fail_count = sum(1 for r in results if not r.success)

        today = datetime.now().strftime("%Y-%m-%d")
        if today not in self.state.daily_stats:
            self.state.daily_stats[today] = {
                "cycles": 0,
                "tool_calls": 0,
                "successes": 0,
                "failures": 0,
            }
        self.state.daily_stats[today]["cycles"] += 1
        self.state.daily_stats[today]["tool_calls"] += len(results)
        self.state.daily_stats[today]["successes"] += success_count
        self.state.daily_stats[today]["failures"] += fail_count

        for result in results:
            event_name = "agent.action.completed" if result.success else "agent.action.failed"
            self.event_bus.publish(
                Event(
                    name=event_name,
                    category=EventCategory.AGENT,
                    payload={
                        "success": result.success,
                        "error": result.error if result.error else None,
                        "duration_ms": result.duration_ms,
                    },
                    source="loop",
                )
            )

    async def start(self) -> None:
        self.state.status = AgentStatus.RUNNING
        self.event_bus.publish(
            Event(
                name="agent.lifecycle.started",
                category=EventCategory.SYSTEM,
                payload={"cycle_count": self.state.cycle_count},
                source="loop",
            )
        )

        while self.state.status == AgentStatus.RUNNING:
            try:
                await self.run_cycle()
            except Exception as exc:
                self.event_bus.publish(
                    Event(
                        name="agent.cycle.error",
                        category=EventCategory.SYSTEM,
                        payload={"error": str(exc)},
                        source="loop",
                    )
                )

            busy = len(self.state.insights) > 0 and any(
                i.urgency in (Urgency.CRITICAL, Urgency.HIGH) for i in self.state.insights
            )
            interval = (
                self.config.get("cycle_interval_busy", 10)
                if busy
                else self.config.get("cycle_interval", 300)
            )
            await asyncio.sleep(interval)

    def pause(self) -> None:
        if self.state.status == AgentStatus.RUNNING:
            self.state.status = AgentStatus.PAUSED
            self._state_store.save(self.state)
            self.event_bus.publish(
                Event(
                    name="agent.lifecycle.paused",
                    category=EventCategory.SYSTEM,
                    source="loop",
                )
            )

    def resume(self) -> None:
        if self.state.status == AgentStatus.PAUSED:
            self.state.status = AgentStatus.RUNNING
            self._state_store.save(self.state)
            self.event_bus.publish(
                Event(
                    name="agent.lifecycle.resumed",
                    category=EventCategory.SYSTEM,
                    source="loop",
                )
            )

    def stop(self) -> None:
        self.state.status = AgentStatus.STOPPED
        self._state_store.save(self.state)
        self.event_bus.publish(
            Event(
                name="agent.lifecycle.stopped",
                category=EventCategory.SYSTEM,
                payload={"cycle_count": self.state.cycle_count},
                source="loop",
            )
        )

    def get_status(self) -> dict:
        return {
            "status": self.state.status.value,
            "cycle_count": self.state.cycle_count,
            "last_cycle_time": self.state.last_cycle_time,
            "total_tool_calls": self.state.total_tool_calls,
            "total_success": self.state.total_success,
            "total_failed": self.state.total_failed,
            "success_rate": f"{self.state.success_rate():.1f}%",
            "pending_approvals": len(self.state.pending_approvals),
            "current_plan_steps": len(self.state.current_plan.steps) if self.state.current_plan else 0,
            "insights_count": len(self.state.insights),
            "daily_stats": dict(self.state.daily_stats),
            "safety": self.safety_engine.get_status(),
            "event_stats": self.event_bus.stats(),
        }

    def _load_config(self) -> dict:
        defaults: dict = {
            "cycle_interval": 300,
            "cycle_interval_busy": 10,
            "max_concurrent_tasks": 5,
            "learning_enabled": True,
        }
        config_path = REPO_ROOT / "config" / "jarvis.yaml"
        if not config_path.exists():
            return defaults
        try:
            import yaml

            with open(config_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}

            agent_config = data.get("agent", {})
            for key in defaults:
                if key in agent_config:
                    defaults[key] = agent_config[key]
            return defaults
        except Exception:
            return defaults

    def _system_status_str(self) -> str:
        wiki_dir = REPO_ROOT / "wiki"
        page_count = 0
        categories: dict[str, int] = {}
        if wiki_dir.exists():
            for p in wiki_dir.rglob("*.md"):
                if p.name in ("index.md", "log.md", "lint-report.md", "health-report.md"):
                    continue
                page_count += 1
                parent = p.parent.name
                categories[parent] = categories.get(parent, 0) + 1

        cat_lines = "\n".join(f"  - {k}: {v} pages" for k, v in sorted(categories.items()))

        safety_status = self.safety_engine.get_status()
        rate_usage = safety_status.get("rate_usage", {})

        return (
            f"Wiki pages: {page_count}\n"
            f"Categories:\n{cat_lines}\n"
            f"Agent cycles: {self.state.cycle_count}\n"
            f"Tool calls: {self.state.total_tool_calls} (success={self.state.total_success}, failed={self.state.total_failed})\n"
            f"Rate usage: minute={rate_usage.get('per_minute', '0/30')}, hour={rate_usage.get('per_hour', '0/200')}, day={rate_usage.get('per_day', '0/1000')}\n"
            f"Safety blocked: {safety_status.get('blocked_count', 0)}\n"
            f"Pending approvals: {len(self.state.pending_approvals)}"
        )

    @staticmethod
    def _hours_since(iso_timestamp: str) -> float:
        try:
            then = datetime.fromisoformat(iso_timestamp)
            delta = datetime.now() - then
            return delta.total_seconds() / 3600
        except (ValueError, TypeError):
            return 999.0

    def resolve_approval(self, req_id: str, approved: bool) -> bool:
        """Resolve a pending approval request. Called by API endpoints when user approves/rejects."""
        if req_id in self._approval_events:
            self._approval_results[req_id] = approved
            self._approval_events[req_id].set()
            return True
        return False


_loop: AgentLoop | None = None


def get_agent_loop() -> AgentLoop:
    global _loop
    if _loop is None:
        _loop = AgentLoop()
    return _loop
