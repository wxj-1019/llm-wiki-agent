#!/usr/bin/env python3
"""MCP server health monitoring."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
STATE_FILE = REPO_ROOT / "state" / "mcp_health.json"


class MCPHealthMonitor:
    """Track MCP server start/stop events and auto-disable failing servers."""

    def __init__(self, state_file: Path | None = None):
        self._state_file = state_file or STATE_FILE
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state = self._load()

    def record_start(self, server_name: str, success: bool):
        if server_name not in self._state:
            self._state[server_name] = {"consecutive_failures": 0, "last_failure": "", "disabled": False, "total_starts": 0}
        info = self._state[server_name]
        info["total_starts"] = info.get("total_starts", 0) + 1
        if success:
            info["consecutive_failures"] = 0
        else:
            info["consecutive_failures"] = info.get("consecutive_failures", 0) + 1
            info["last_failure"] = datetime.now().isoformat()
        self._save()

    def should_disable(self, server_name: str) -> bool:
        info = self._state.get(server_name)
        if not info:
            return False
        return info.get("consecutive_failures", 0) >= 3

    def get_health_panel(self) -> str:
        lines = ["MCP Health Panel", "=" * 50]
        for name, info in sorted(self._state.items()):
            fails = info.get("consecutive_failures", 0)
            disabled = info.get("disabled", False)
            status = "DISABLED" if disabled else ("FAIL" if fails >= 3 else "OK")
            lines.append(f"  {name:<20} | {status:<10} | failures={fails} | starts={info.get('total_starts', 0)}")
        return "\n".join(lines)

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
