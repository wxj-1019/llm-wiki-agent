#!/usr/bin/env python3
"""Adaptive threshold framework — centralized threshold management."""
from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
THRESHOLDS_FILE = REPO_ROOT / "state" / "thresholds.json"

DEFAULTS = {
    "quality_thresholds": {"good": 70, "acceptable": 40},
    "concurrency": {"default": 3, "max": 10},
    "retry": {"default": 2, "max": 5},
    "cache_ttl": {"default": 5, "stable": 60, "active": 1},
    "debounce": 5,
    "timeout": 30,
    "max_input_tokens": 6000,
    "circuit_breaker": {"failure_threshold": 5, "cooldown_seconds": 60},
    "budget": {"daily_usd": 5.0, "warning_threshold": 0.8},
}

_cached: dict | None = None


def _load() -> dict:
    global _cached
    if _cached is not None:
        return _cached
    if THRESHOLDS_FILE.exists():
        try:
            _cached = json.loads(THRESHOLDS_FILE.read_text(encoding="utf-8"))
            return _cached
        except (json.JSONDecodeError, OSError):
            pass
    _cached = {}
    return _cached


def get_threshold(key: str, default=None):
    """Read threshold from state/thresholds.json with fallback to DEFAULTS."""
    overrides = _load()
    if key in overrides:
        return overrides[key]
    if key in DEFAULTS:
        return DEFAULTS[key]
    # Support nested keys like "quality_thresholds.good"
    parts = key.split(".")
    if len(parts) == 2:
        section, field = parts
        override_val = overrides.get(section, {}).get(field)
        if override_val is not None:
            return override_val
        default_val = DEFAULTS.get(section, {}).get(field)
        if default_val is not None:
            return default_val
    return default


def update_threshold(key: str, value) -> None:
    """Update threshold in state/thresholds.json."""
    global _cached
    data = _load()
    if "." in key:
        section, field = key.split(".", 1)
        data.setdefault(section, {})[field] = value
    else:
        data[key] = value
    THRESHOLDS_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = THRESHOLDS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(THRESHOLDS_FILE)
    _cached = data


def list_thresholds() -> dict:
    """Return all thresholds (defaults + overrides merged)."""
    result = dict(DEFAULTS)
    overrides = _load()
    for k, v in overrides.items():
        if isinstance(v, dict) and isinstance(result.get(k), dict):
            result[k] = {**result[k], **v}
        else:
            result[k] = v
    return result
