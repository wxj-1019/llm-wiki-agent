import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))


def test_all_modules_import():
    from tools.jarvis.loop import AgentLoop
    from tools.jarvis.safety import get_safety_engine
    from tools.jarvis.approval import get_approval_manager
    from tools.jarvis.tools.comm_tools import register_all
    assert AgentLoop is not None
    assert get_safety_engine is not None
    assert get_approval_manager is not None
    assert register_all is not None
