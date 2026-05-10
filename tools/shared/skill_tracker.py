#!/usr/bin/env python3
"""Skill usage tracking and auto-disable for idle skills."""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
STATE_FILE = REPO_ROOT / "state" / "skill_usage.json"


class SkillUsageTracker:
    """Track skill usage and auto-disable idle skills."""

    def __init__(self, state_file: Path | None = None):
        self._state_file = state_file or STATE_FILE
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state = self._load()

    def record_use(self, skill_name: str):
        if skill_name not in self._state:
            self._state[skill_name] = {"last_used": "", "use_count_30d": 0, "disabled": False}
        self._state[skill_name]["last_used"] = datetime.now().isoformat()
        self._state[skill_name]["use_count_30d"] = self._state[skill_name].get("use_count_30d", 0) + 1
        self._save()

    def auto_disable_idle(self, idle_days: int = 30) -> list[str]:
        disabled = []
        cutoff = datetime.now() - timedelta(days=idle_days)
        for name, info in self._state.items():
            if info.get("disabled"):
                continue
            last_used = info.get("last_used", "")
            if not last_used:
                continue
            try:
                last_dt = datetime.fromisoformat(last_used)
                if last_dt < cutoff:
                    info["disabled"] = True
                    disabled.append(name)
            except ValueError:
                continue
        if disabled:
            self._save()
        return disabled

    def get_stats(self) -> dict:
        total = len(self._state)
        active = sum(1 for v in self._state.values() if not v.get("disabled"))
        return {"total_skills": total, "active": active, "disabled": total - active}

    def _load(self) -> dict:
        if self._state_file.exists():
            try:
                return json.loads(self._state_file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        return {}

    def _save(self):
        tmp = self._state_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._state, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self._state_file)
