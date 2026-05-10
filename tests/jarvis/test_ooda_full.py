import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import asyncio
from unittest.mock import patch
from tools.jarvis.loop import AgentLoop
from tools.jarvis.types import Event, EventCategory, EventSource


def test_full_ooda_cycle_with_mock_llm():
    loop = AgentLoop()

    # Inject a synthetic event so reason() has something to process
    loop.event_bus.publish(
        Event(
            name="agent.test.trigger",
            category=EventCategory.SYSTEM,
            payload={"action": "noop"},
            source=EventSource.LOOP,
        )
    )

    # Mock call_llm to return a deterministic insight
    mock_response = '[{"description": "Test insight", "urgency": "low", "suggested_action": "Run noop", "tool_calls": [{"tool": "noop", "params": {}}], "risk_level": "L0", "reasoning": "test"}]'

    with patch("tools.jarvis.loop.call_llm", return_value=mock_response):
        cycle_id = asyncio.run(loop.run_cycle())

    assert cycle_id.startswith("cycle_")
    assert loop.state.cycle_count >= 1
    # Verify plan was optimized by Planner
    assert loop.state.current_plan is not None
    assert loop.state.current_plan.estimated_cost is not None
    assert "total_steps" in loop.state.current_plan.estimated_cost


def test_ooda_cycle_no_events():
    """When no events exist, reason returns empty insights and plan has 0 steps."""
    loop = AgentLoop()

    with patch("tools.jarvis.loop.call_llm", return_value="[]"):
        cycle_id = asyncio.run(loop.run_cycle())

    assert cycle_id.startswith("cycle_")
    assert loop.state.current_plan is not None
    assert len(loop.state.current_plan.steps) == 0
