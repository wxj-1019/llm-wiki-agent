#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

from tools.jarvis.types import Insight, RiskLevel, Urgency

REPO_ROOT = Path(__file__).parent.parent.parent

CUSTOM_STRATEGIES_PATH = REPO_ROOT / "state" / "jarvis_custom_strategies.json"

BUILTIN_STRATEGIES: list[dict] = [
    {
        "name": "conservative",
        "description": "Only auto-execute L0/L1, always ask for approval on L2+, max 10 tool calls per cycle",
        "rules": [
            {"type": "auto_execute_levels", "levels": ["L0", "L1"]},
            {"type": "require_approval_levels", "levels": ["L2", "L3", "L4"]},
            {"type": "max_tool_calls_per_cycle", "value": 10},
            {"type": "drop_urgency", "levels": ["medium", "low"]},
        ],
    },
    {
        "name": "balanced",
        "description": "Auto-execute L0-L2, ask approval on L3+, max 30 tool calls per cycle",
        "rules": [
            {"type": "auto_execute_levels", "levels": ["L0", "L1", "L2"]},
            {"type": "require_approval_levels", "levels": ["L3", "L4"]},
            {"type": "max_tool_calls_per_cycle", "value": 30},
        ],
    },
    {
        "name": "aggressive",
        "description": "Auto-execute L0-L2, auto-approve L3 with rate limit, max 50 tool calls per cycle",
        "rules": [
            {"type": "auto_execute_levels", "levels": ["L0", "L1", "L2"]},
            {"type": "auto_approve_with_rate_limit", "levels": ["L3"], "max_per_hour": 10},
            {"type": "require_approval_levels", "levels": ["L4"]},
            {"type": "max_tool_calls_per_cycle", "value": 50},
            {"type": "promote_urgency", "from": "high", "to": "immediate"},
        ],
    },
]


class Strategies:
    def __init__(self):
        self._strategies: dict[str, dict] = {}
        for s in BUILTIN_STRATEGIES:
            self._strategies[s["name"]] = s
        self.load_custom_strategies()

    def get_strategy(self, name: str) -> dict:
        strategy = self._strategies.get(name)
        if strategy is None:
            raise KeyError(f"Strategy '{name}' not found")
        return strategy

    def list_strategies(self) -> list[dict]:
        return [
            {"name": s["name"], "description": s["description"]}
            for s in self._strategies.values()
        ]

    def apply_strategy(self, strategy_name: str, insights: list[Insight]) -> list[Insight]:
        strategy = self.get_strategy(strategy_name)
        rules = strategy.get("rules", [])

        drop_urgency_levels: list[str] = []
        promote_map: dict[str, str] = {}

        for rule in rules:
            if rule["type"] == "drop_urgency":
                drop_urgency_levels = [u.lower() for u in rule["levels"]]
            elif rule["type"] == "promote_urgency":
                promote_map[rule["from"].lower()] = rule["to"].lower()

        filtered: list[Insight] = []
        for insight in insights:
            urgency_value = insight.urgency.value.lower()
            if urgency_value in drop_urgency_levels:
                continue
            if urgency_value in promote_map:
                target = promote_map[urgency_value]
                try:
                    insight.urgency = Urgency(target)
                except ValueError:
                    pass
            filtered.append(insight)

        urgency_order = {
            Urgency.CRITICAL: 0,
            Urgency.HIGH: 1,
            Urgency.MEDIUM: 2,
            Urgency.LOW: 3,
        }
        filtered.sort(key=lambda i: urgency_order.get(i.urgency, 99))

        return filtered

    def should_auto_execute(self, strategy_name: str, risk_level) -> bool:
        strategy = self.get_strategy(strategy_name)
        rules = strategy.get("rules", [])

        if isinstance(risk_level, RiskLevel):
            level_value = risk_level.value
        else:
            level_value = str(risk_level)

        for rule in rules:
            if rule["type"] == "auto_execute_levels":
                if level_value in rule["levels"]:
                    return True
            elif rule["type"] == "auto_approve_with_rate_limit":
                if level_value in rule["levels"]:
                    return True

        return False

    def get_max_tool_calls(self, strategy_name: str) -> int:
        strategy = self.get_strategy(strategy_name)
        for rule in strategy.get("rules", []):
            if rule["type"] == "max_tool_calls_per_cycle":
                return rule["value"]
        return 30

    def create_custom_strategy(self, name: str, description: str, rules: dict) -> dict:
        strategy = {
            "name": name,
            "description": description,
            "rules": rules.get("rules", []),
        }
        self._strategies[name] = strategy
        self._save_custom_strategies()
        return strategy

    def load_custom_strategies(self):
        if not CUSTOM_STRATEGIES_PATH.exists():
            return
        try:
            with open(CUSTOM_STRATEGIES_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                for s in data:
                    if isinstance(s, dict) and "name" in s:
                        self._strategies[s["name"]] = s
        except (json.JSONDecodeError, OSError):
            pass

    def _save_custom_strategies(self):
        custom = [
            s
            for s in self._strategies.values()
            if s["name"] not in {bs["name"] for bs in BUILTIN_STRATEGIES}
        ]
        CUSTOM_STRATEGIES_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CUSTOM_STRATEGIES_PATH, "w", encoding="utf-8") as f:
            json.dump(custom, f, indent=2, ensure_ascii=False)


_strategies: Strategies | None = None


def get_strategies() -> Strategies:
    global _strategies
    if _strategies is None:
        _strategies = Strategies()
    return _strategies
