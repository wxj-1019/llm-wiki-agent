import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.shared_utils import parse_llm_json, load_yaml_config


def test_parse_llm_json_plain():
    raw = '[{"a": 1}]'
    assert parse_llm_json(raw) == [{"a": 1}]


def test_parse_llm_json_fenced():
    raw = '```json\n[{"a": 1}]\n```'
    assert parse_llm_json(raw) == [{"a": 1}]


def test_parse_llm_json_dict():
    raw = '{"steps": []}'
    assert parse_llm_json(raw) == {"steps": []}


def test_parse_llm_json_invalid():
    assert parse_llm_json("not json") is None


def test_load_yaml_config_missing():
    result = load_yaml_config("/nonexistent/path.yaml", {"default": True})
    assert result == {"default": True}


from tools.jarvis.shared_utils import safe_subprocess, normalize_path, iso_now
from tools.jarvis.types import EventSource


def test_safe_subprocess_echo():
    result = safe_subprocess([sys.executable, "-c", "print('hello')"])
    assert result["returncode"] == 0
    assert "hello" in result["stdout"]


def test_safe_subprocess_not_found():
    result = safe_subprocess(["this_command_does_not_exist_12345"])
    assert result["returncode"] == -1
    assert "not found" in result["stderr"].lower() or "Command not found" in result["stderr"]


def test_normalize_path_safe():
    import os
    base = os.getcwd()
    result = normalize_path("README.md", base)
    assert result is not None
    assert result.name == "README.md"


def test_normalize_path_traversal():
    import os
    base = os.getcwd()
    result = normalize_path("../../etc/passwd", base)
    assert result is None


def test_iso_now_format():
    now = iso_now()
    assert isinstance(now, str)
    assert "T" in now


def test_event_source_values():
    assert EventSource.LOOP == "loop"
    assert EventSource.MULTI_AGENT == "multi_agent"
    assert EventSource.USER == "user"
