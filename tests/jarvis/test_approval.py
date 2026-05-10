import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.approval import ApprovalManager
from tools.jarvis.types import PlanStep, RiskLevel


def test_never_auto_approve_blocks():
    mgr = ApprovalManager()
    step = PlanStep(tool_name="git_push", params={"remote": "origin"}, risk_level=RiskLevel.L3)
    result = mgr.auto_approve_check(step)
    assert result is False


def test_never_auto_approve_del_command():
    mgr = ApprovalManager()
    step = PlanStep(tool_name="terminal_exec", params={"command": "rm -rf /tmp"}, risk_level=RiskLevel.L3)
    result = mgr.auto_approve_check(step)
    assert result is False


def test_auto_approve_uses_yaml_rules():
    mgr = ApprovalManager()
    step = PlanStep(tool_name="git_commit", params={"message": "auto-fix: typo"}, risk_level=RiskLevel.L2)
    # Should match the first rule in approval_policies.yaml
    result = mgr.auto_approve_check(step)
    # First call should be within rate limit
    assert result is True
