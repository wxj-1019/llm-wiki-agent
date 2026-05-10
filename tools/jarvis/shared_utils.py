#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def parse_llm_json(raw: str) -> list | dict | None:
    """Strip markdown fences and parse JSON from LLM output.
    Returns a list or dict, or None if parsing fails.
    """
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        try:
            first_newline = cleaned.index("\n")
            last_backtick = cleaned.rindex("```")
            cleaned = cleaned[first_newline + 1 : last_backtick].strip()
        except ValueError:
            pass
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, (list, dict)):
            return parsed
    except (json.JSONDecodeError, ValueError):
        pass
    return None


def load_yaml_config(path: str | Path, defaults: dict | None = None) -> dict:
    """Load a YAML config file with fallback defaults.
    Returns a dict (never None).
    """
    result: dict = dict(defaults) if defaults else {}
    p = Path(path)
    if not p.exists():
        return result
    try:
        import yaml
        with open(p, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        if isinstance(data, dict):
            result.update(data)
        return result
    except Exception:
        return result
