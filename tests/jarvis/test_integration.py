import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))


def test_loop_components_wired():
    """Verify all major subsystems are connected to the loop."""
    from tools.jarvis.loop import AgentLoop
    loop = AgentLoop()

    assert loop.planner is not None
    assert loop.learner is not None
    assert loop.state_store is not None
    assert loop.approval_manager is not None
    assert loop.safety_engine is not None
    assert loop.registry is not None
    assert loop.event_bus is not None


def test_approval_never_auto_loaded():
    """Verify deny-list is populated from YAML."""
    from tools.jarvis.approval import get_approval_manager
    mgr = get_approval_manager()
    assert len(mgr._never_auto) > 0
    assert "git_push" in mgr._never_auto


def test_multi_agent_has_lifecycle():
    """Verify task lifecycle methods exist."""
    from tools.jarvis.multi_agent import MultiAgentManager
    mgr = MultiAgentManager()
    assert hasattr(mgr, "start_task")
    assert hasattr(mgr, "complete_task")
    assert hasattr(mgr, "fail_task")


def test_shared_utils_exports():
    """Verify shared utilities are importable and functional."""
    from tools.jarvis.shared_utils import parse_llm_json, load_yaml_config
    assert parse_llm_json('{"a": 1}') == {"a": 1}
    assert load_yaml_config("/nonexistent", {"fallback": True}) == {"fallback": True}
