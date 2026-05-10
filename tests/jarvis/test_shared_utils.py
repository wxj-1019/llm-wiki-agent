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
