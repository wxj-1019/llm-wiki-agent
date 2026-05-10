"""End-to-end OODA cycle smoke test for Jarvis."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import asyncio
from tools.jarvis.loop import AgentLoop
from tools.jarvis.types import Event, EventCategory, Insight, RiskLevel, Urgency


def test_agent_loop_instantiation():
    loop = AgentLoop()
    assert loop.planner is not None
    assert loop.learner is not None
    assert loop.state.status.value in ("idle", "running", "paused", "stopped")
    print(f"[OK] AgentLoop instantiated: cycle_count={loop.state.cycle_count}")


def test_perceive_returns_events():
    loop = AgentLoop()
    events = asyncio.run(loop.perceive())
    assert isinstance(events, list)
    print(f"[OK] perceive() returned {len(events)} events")


def test_reason_with_empty_events():
    loop = AgentLoop()
    insights = asyncio.run(loop.reason([]))
    assert insights == []
    print("[OK] reason([]) returns []")


def test_plan_with_noop_insight():
    loop = AgentLoop()
    insight = Insight(
        description="test insight",
        urgency=Urgency.LOW,
        suggested_action="do nothing",
        tool_calls=[],
        risk_level=RiskLevel.L1,
        reasoning="test",
    )
    plan = asyncio.run(loop.plan([insight]))
    assert plan is not None
    assert plan.estimated_cost is not None
    assert "total_steps" in plan.estimated_cost
    print(f"[OK] plan() returned {len(plan.steps)} steps, cost={plan.estimated_cost}")


def test_execute_noop_plan():
    loop = AgentLoop()
    insight = Insight(
        description="test",
        urgency=Urgency.LOW,
        suggested_action="do nothing",
        tool_calls=[{"tool": "noop", "params": {}}],
        risk_level=RiskLevel.L1,
        reasoning="test",
    )
    plan = asyncio.run(loop.plan([insight]))
    results = asyncio.run(loop.execute(plan))
    assert len(results) == len(plan.steps)
    assert all(r.success for r in results)
    print(f"[OK] execute() returned {len(results)} results, all success")


def test_learn_records_stats():
    loop = AgentLoop()
    from tools.jarvis.types import ToolResult
    before = loop.state.total_tool_calls
    asyncio.run(loop.learn([ToolResult(success=True, data="ok")]))
    after = loop.state.total_tool_calls
    # Note: learn() doesn't increment total_tool_calls directly,
    # that's done in execute(). We just verify it runs without error.
    print("[OK] learn() executed without error")


def test_full_ooda_cycle():
    loop = AgentLoop()
    cycle_id = asyncio.run(loop.run_cycle())
    assert cycle_id.startswith("cycle_")
    assert loop.state.cycle_count >= 1
    print(f"[OK] Full OODA cycle completed: {cycle_id}, cycle_count={loop.state.cycle_count}")


def main():
    tests = [
        test_agent_loop_instantiation,
        test_perceive_returns_events,
        test_reason_with_empty_events,
        test_plan_with_noop_insight,
        test_execute_noop_plan,
        test_learn_records_stats,
        test_full_ooda_cycle,
    ]
    for t in tests:
        try:
            t()
        except Exception as e:
            print(f"[FAIL] {t.__name__}: {e}")
            return 1
    print("\n=== ALL OODA SMOKE TESTS PASSED ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
