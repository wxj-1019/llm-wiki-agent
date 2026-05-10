#!/usr/bin/env python3
"""Shared configuration loader for Jarvis subsystems."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.parent


class ConfigCache:
    """Simple file-based config cache with environment-variable interpolation."""

    def __init__(self):
        self._cache: dict[str, Any] = {}

    def load_yaml(self, name: str, defaults: dict[str, Any] | None = None) -> dict[str, Any]:
        """Load *config/{name}.yaml* and merge with *defaults*."""
        if name in self._cache:
            return self._cache[name]
        data: dict[str, Any] = dict(defaults or {})
        path = REPO_ROOT / "config" / f"{name}.yaml"
        if path.exists():
            try:
                import yaml
                loaded = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
                if isinstance(loaded, dict):
                    data = self._deep_merge(data, loaded)
            except Exception as exc:
                import logging
                logging.getLogger(__name__).warning("Failed to load %s: %s", path, exc)
        self._cache[name] = data
        return data

    def load_pg(self) -> dict[str, Any]:
        """Load PostgreSQL connection config from database.yaml + env."""
        defaults: dict[str, Any] = {
            "host": os.getenv("PG_HOST", "localhost"),
            "port": int(os.getenv("PG_PORT", "5432")),
            "database": os.getenv("PG_DATABASE", "llm_wiki"),
            "user": os.getenv("PG_USER", "wiki_user"),
            "password": os.getenv("PG_PASSWORD", ""),
            "sslmode": "prefer",
            "pool_min": 2,
            "pool_max": 10,
        }
        path = REPO_ROOT / "config" / "database.yaml"
        if path.exists():
            try:
                import yaml
                loaded = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            except Exception:
                loaded = {}
        else:
            loaded = {}
        pg = loaded.get("database", {}).get("postgresql", {}) if isinstance(loaded, dict) else {}
        for key in defaults:
            if key in pg and pg[key]:
                val = pg[key]
                if isinstance(val, str) and val.startswith("${") and val.endswith("}"):
                    defaults[key] = os.getenv(val[2:-1], "")
                else:
                    defaults[key] = val
        return defaults

    @staticmethod
    def _deep_merge(base: dict, overlay: dict) -> dict:
        merged = dict(base)
        for key, val in overlay.items():
            if isinstance(val, dict) and key in merged and isinstance(merged[key], dict):
                merged[key] = ConfigCache._deep_merge(merged[key], val)
            else:
                merged[key] = val
        return merged

    def reset(self) -> None:
        """Clear all cached configs (useful in tests)."""
        self._cache.clear()


# module-level singleton
_cache = ConfigCache()


def load_yaml(name: str, defaults: dict[str, Any] | None = None) -> dict[str, Any]:
    return _cache.load_yaml(name, defaults)


def load_pg() -> dict[str, Any]:
    return _cache.load_pg()


def reset_cache() -> None:
    _cache.reset()
