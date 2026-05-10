import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.audit import get_audit_store
from tools.jarvis.types import PlanStep, ToolResult, RiskLevel


def test_write_and_query():
    store = get_audit_store()
    step = PlanStep(tool_name="noop", params={}, risk_level=RiskLevel.L0)
    result = ToolResult(success=True, data="ok")
    store.write(step, result)
    rows = store.query(limit=5)
    assert isinstance(rows, list)
