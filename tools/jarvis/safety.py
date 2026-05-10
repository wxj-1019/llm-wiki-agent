#!/usr/bin/env python3
from __future__ import annotations

import re
import time
from dataclasses import dataclass
from pathlib import Path

from tools.jarvis.types import PlanStep, RiskLevel, ToolResult

REPO_ROOT = Path(__file__).parent.parent.parent


@dataclass
class SafetyCheckResult:
    passed: bool
    reason: str
    risk_level: RiskLevel


class SafetyEngine:
    def __init__(self):
        self._emergency_stopped: bool = False
        self._red_lines: list[str] = [
            "never_delete_raw_files",
            "never_expose_api_keys",
            "never_modify_tools_without_approval",
            "never_send_private_data_externally",
        ]
        self._rate_limits: dict = {
            "max_tool_calls_per_minute": 30,
            "max_tool_calls_per_hour": 200,
            "max_tool_calls_per_day": 1000,
        }
        self._call_log: list[float] = []
        self._blocked_commands: list[str] = [
            "rm -rf /",
            "format",
            "del /s",
            "shutdown",
            "rmdir /s",
        ]
        self._blocked_patterns: list[str] = [
            r"sk-[a-zA-Z0-9]{20,}",
            r"AKIA[0-9A-Z]{16}",
            r"AIza[a-zA-Z0-9_-]{35}",
            r"ghp_[a-zA-Z0-9]{36}",
            r"gho_[a-zA-Z0-9]{36}",
            r"xox[bpsa]-[a-zA-Z0-9-]+",
            r"eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}",
        ]
        self._blocked_count: int = 0
        self._load_config()

    def _load_config(self):
        config_path = REPO_ROOT / "config" / "jarvis.yaml"
        if not config_path.exists():
            return
        try:
            import yaml

            with open(config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f) or {}

            safety_config = config.get("safety", {})
            if "rate_limits" in safety_config:
                for key, value in safety_config["rate_limits"].items():
                    if key in self._rate_limits:
                        self._rate_limits[key] = int(value)
            if "blocked_commands" in safety_config:
                extra = safety_config["blocked_commands"]
                if isinstance(extra, list):
                    self._blocked_commands.extend(extra)
            if "blocked_patterns" in safety_config:
                extra = safety_config["blocked_patterns"]
                if isinstance(extra, list):
                    self._blocked_patterns.extend(extra)
        except Exception:
            pass

    def pre_check(self, step: PlanStep) -> SafetyCheckResult:
        if self._emergency_stopped:
            self._blocked_count += 1
            return SafetyCheckResult(
                passed=False,
                reason="Emergency stop is active — all operations blocked",
                risk_level=RiskLevel.L4,
            )

        red_line_result = self._check_red_lines(step)
        if not red_line_result:
            self._blocked_count += 1
            return SafetyCheckResult(
                passed=False,
                reason=f"Red line violation detected",
                risk_level=RiskLevel.L4,
            )

        if not self._check_rate_limit():
            self._blocked_count += 1
            return SafetyCheckResult(
                passed=False,
                reason="Rate limit exceeded",
                risk_level=RiskLevel.L3,
            )

        if not self._check_blocked_commands(step):
            self._blocked_count += 1
            return SafetyCheckResult(
                passed=False,
                reason=f"Blocked command detected in step",
                risk_level=RiskLevel.L4,
            )

        if not self._check_api_key_exposure(step):
            self._blocked_count += 1
            return SafetyCheckResult(
                passed=False,
                reason="Potential API key exposure detected",
                risk_level=RiskLevel.L4,
            )

        risk = step.risk_level
        if risk in (RiskLevel.L3, RiskLevel.L4) and not step.requires_approval:
            return SafetyCheckResult(
                passed=True,
                reason=f"High risk step (L3+) detected — approval recommended",
                risk_level=risk,
            )

        return SafetyCheckResult(
            passed=True,
            reason="All safety checks passed",
            risk_level=RiskLevel.L0,
        )

    def _check_red_lines(self, step: PlanStep) -> bool:
        tool = step.tool_name.lower()
        params = step.params

        if "never_delete_raw_files" in self._red_lines:
            if tool in ("file_delete", "terminal_exec"):
                if tool == "file_delete":
                    path = str(params.get("path", ""))
                    if path.startswith("raw/") or path.startswith("raw\\"):
                        return False
                if tool == "terminal_exec":
                    cmd = str(params.get("command", ""))
                    if re.search(r"\braw[/\\]", cmd):
                        if any(kw in cmd.lower() for kw in ("rm", "del", "remove", "rmdir")):
                            return False

        if "never_modify_tools_without_approval" in self._red_lines:
            if tool in ("file_write", "file_edit", "terminal_exec"):
                if tool in ("file_write", "file_edit"):
                    path = str(params.get("path", ""))
                    if path.startswith("tools/") or path.startswith("tools\\"):
                        if not step.requires_approval:
                            return False
                if tool == "terminal_exec":
                    cmd = str(params.get("command", ""))
                    if re.search(r"\btools[/\\]", cmd):
                        if not step.requires_approval:
                            return False

        if "never_send_private_data_externally" in self._red_lines:
            if tool in ("http_request", "web_fetch", "api_call"):
                body = str(params.get("body", "")) + str(params.get("data", ""))
                raw_path = str(params.get("raw_path", ""))
                if raw_path and raw_path.startswith("raw/"):
                    return False
                if any(kw in body.lower() for kw in ("password", "secret", "private_key")):
                    return False

        return True

    def _check_rate_limit(self) -> bool:
        now = time.time()
        self._call_log = [t for t in self._call_log if now - t < 86400]

        minute_calls = sum(1 for t in self._call_log if now - t < 60)
        hour_calls = sum(1 for t in self._call_log if now - t < 3600)
        day_calls = len(self._call_log)

        if minute_calls >= self._rate_limits["max_tool_calls_per_minute"]:
            return False
        if hour_calls >= self._rate_limits["max_tool_calls_per_hour"]:
            return False
        if day_calls >= self._rate_limits["max_tool_calls_per_day"]:
            return False

        return True

    def _check_blocked_commands(self, step: PlanStep) -> bool:
        if step.tool_name.lower() != "terminal_exec":
            return True

        command = str(step.params.get("command", "")).lower()
        for blocked in self._blocked_commands:
            if blocked.lower() in command:
                return False
        return True

    def _check_api_key_exposure(self, step: PlanStep) -> bool:
        param_str = str(step.params)
        for pattern in self._blocked_patterns:
            if re.search(pattern, param_str):
                return False
        return True

    def record_call(self):
        self._call_log.append(time.time())

    def get_status(self) -> dict:
        now = time.time()
        self._call_log = [t for t in self._call_log if now - t < 86400]

        minute_calls = sum(1 for t in self._call_log if now - t < 60)
        hour_calls = sum(1 for t in self._call_log if now - t < 3600)
        day_calls = len(self._call_log)

        return {
            "emergency_stopped": self._emergency_stopped,
            "rate_usage": {
                "per_minute": f"{minute_calls}/{self._rate_limits['max_tool_calls_per_minute']}",
                "per_hour": f"{hour_calls}/{self._rate_limits['max_tool_calls_per_hour']}",
                "per_day": f"{day_calls}/{self._rate_limits['max_tool_calls_per_day']}",
            },
            "red_lines": list(self._red_lines),
            "blocked_count": self._blocked_count,
            "rate_limits": dict(self._rate_limits),
        }

    def emergency_stop(self) -> bool:
        self._emergency_stopped = True
        return True

    def reset_emergency(self):
        self._emergency_stopped = False


_engine: SafetyEngine | None = None


def get_safety_engine() -> SafetyEngine:
    global _engine
    if _engine is None:
        _engine = SafetyEngine()
    return _engine
