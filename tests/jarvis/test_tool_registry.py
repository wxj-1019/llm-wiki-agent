import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.tool_registry import get_registry
from tools.jarvis.types import ToolDef, RiskLevel


def test_register_and_get():
    reg = get_registry()

    def dummy_tool(x: int) -> int:
        return x * 2

    reg.register(
        name="test_double",
        fn=dummy_tool,
        description="Doubles a number",
        risk_level=RiskLevel.L0,
        input_schema={"type": "object", "properties": {"x": {"type": "integer"}}},
    )
    tool = reg.get("test_double")
    assert tool is not None
    assert tool.name == "test_double"


def test_list_tools():
    reg = get_registry()
    # Ensure at least one tool is registered if registry is empty
    if not reg.list_tools():
        def dummy_tool(x: int) -> int:
            return x * 2
        reg.register(
            name="test_list",
            fn=dummy_tool,
            description="List helper",
            risk_level=RiskLevel.L0,
        )
    tools = reg.list_tools()
    assert len(tools) > 0
