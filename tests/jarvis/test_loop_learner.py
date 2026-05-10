import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.loop import AgentLoop
from tools.jarvis.types import ToolResult


def test_loop_calls_learner():
    loop = AgentLoop()
    # Mock learner to avoid DB writes during test
    call_log = []
    original = loop.learner.record_cycle

    def mock_record(cycle_id, insights, results):
        call_log.append((cycle_id, len(insights), len(results)))

    loop.learner.record_cycle = mock_record  # type: ignore[method-assign]

    import asyncio
    asyncio.run(loop.learn([ToolResult(success=True, data="ok")]))
    assert len(call_log) == 1
    assert call_log[0][2] == 1  # 1 result
