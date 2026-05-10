import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.multi_agent import MultiAgentManager


def test_task_lifecycle():
    mgr = MultiAgentManager()
    # Register a test agent
    agent = mgr.register_agent("test-bot", "watcher", "Test agent")
    agent_id = agent["id"]

    # Assign task
    task = mgr.assign_task(agent_id, "check system health")
    task_id = task["id"]
    assert task["status"] == "pending"

    # Start task
    assert mgr.start_task(task_id) is True
    t = mgr.get_task(task_id)
    assert t["status"] == "running"

    # Complete task
    assert mgr.complete_task(task_id, result={"ok": True}) is True
    t = mgr.get_task(task_id)
    assert t["status"] == "completed"

    # Check agent stats updated
    status = mgr.get_agent_status(agent_id)
    assert status["agent"]["tasks_completed"] == 1

    # Fail a task
    task2 = mgr.assign_task(agent_id, "check failing thing")
    assert mgr.fail_task(task2["id"], error="timeout") is True
    status = mgr.get_agent_status(agent_id)
    assert status["agent"]["tasks_failed"] == 1
