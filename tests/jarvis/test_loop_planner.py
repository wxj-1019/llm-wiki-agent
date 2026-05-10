import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.loop import AgentLoop
from tools.jarvis.types import Insight, RiskLevel, Urgency


def test_loop_uses_planner():
    loop = AgentLoop()
    insight = Insight(
        description="test",
        urgency=Urgency.LOW,
        suggested_action="do something",
        tool_calls=[{"tool": "noop", "params": {}}],
        risk_level=RiskLevel.L1,
        reasoning="test",
    )
    import asyncio
    plan = asyncio.run(loop.plan([insight]))
    # After planner integration, plan should have estimated_cost set
    assert plan.estimated_cost is not None
    assert isinstance(plan.estimated_cost, dict)
    assert "total_steps" in plan.estimated_cost
