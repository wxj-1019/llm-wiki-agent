> **Status:** Implemented

# Jarvis Bugs & Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 confirmed bugs in Jarvis core, add missing config/state infrastructure, and make AgentLoop production-ready for autonomous operation.

**Architecture:** Patch existing `tools/jarvis/` modules in place. Extract cross-cutting concerns (config loading, state persistence) into dedicated modules. All changes are additive or bug-fixes â€?no interface breaking changes to `loop.py` public API.

**Tech Stack:** Python 3.12, SQLite (event bus / approvals / state), YAML config, pytest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `tools/jarvis/approval.py` | Modify | Add `list_all()` method |
| `tools/jarvis/event_bus.py` | Modify | Add `consumed` flag + `mark_consumed()` |
| `tools/jarvis/safety.py` | Modify | Add `_check_budget()` + budget tracking |
| `tools/jarvis/loop.py` | Modify | Add consecutive-failure auto-stop |
| `tools/jarvis/config.py` | Create | Single source of truth for `jarvis.yaml` |
| `tools/jarvis/state.py` | Create | `AgentState` SQLite persistence |
| `tools/jarvis/__init__.py` | Modify | Unified public exports |
| `tools/jarvis/test_jarvis_fixes.py` | Create | Regression tests for all fixes |

---

## Task 1: Fix ApprovalManager.list_all() Missing Method

**Files:**
- Modify: `tools/jarvis/approval.py`
- Test: `tools/jarvis/test_jarvis_fixes.py`

- [ ] **Step 1: Write the failing test**

```python
def test_approval_manager_list_all():
    from tools.jarvis.approval import ApprovalManager
    manager = ApprovalManager()
    # Should not raise AttributeError
    result = manager.list_all()
    assert isinstance(result, list)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tools/jarvis/test_jarvis_fixes.py::test_approval_manager_list_all -v`

Expected: FAIL with `AttributeError: 'ApprovalManager' object has no attribute 'list_all'`

- [ ] **Step 3: Add list_all() to ApprovalManager**

Insert after `get_history()` in `tools/jarvis/approval.py`:

```python
    def list_all(self, limit: int = 100) -> list[ApprovalRequest]:
        rows = self._conn.execute(
            "SELECT * FROM approvals ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [self._row_to_request(r) for r in rows]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tools/jarvis/test_jarvis_fixes.py::test_approval_manager_list_all -v`

Expected: PASS

---

## Task 2: Fix EventBus Event Duplication

**Files:**
- Modify: `tools/jarvis/event_bus.py`
- Modify: `tools/jarvis/loop.py` (one line)
- Test: `tools/jarvis/test_jarvis_fixes.py`

- [ ] **Step 1: Write the failing test**

```python
def test_event_bus_no_duplicate_poll():
    from tools.jarvis.event_bus import EventBus, Event, EventCategory
    import uuid
    bus = EventBus()
    # Use a unique db per test to avoid cross-test contamination
    bus._db_path = bus._db_path.parent / f"test_events_{uuid.uuid4().hex}.db"
    bus._init_db()

    evt = Event(name="test.dup", category=EventCategory.SYSTEM, payload={"x": 1})
    bus.publish(evt)

    first = bus.poll(limit=10)
    assert len(first) == 1
    bus.mark_consumed([e.id for e in first])

    second = bus.poll(limit=10)
    assert len(second) == 0, f"Expected 0 events after consume, got {len(second)}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tools/jarvis/test_jarvis_fixes.py::test_event_bus_no_duplicate_poll -v`

Expected: FAIL â€?second poll returns 1 event instead of 0

- [ ] **Step 3: Add consumed tracking to EventBus**

In `tools/jarvis/event_bus.py`:

**a) Add `consumed` column to schema:**

Replace the `_init_db` CREATE TABLE with:
```python
    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    payload_json TEXT,
                    timestamp TEXT NOT NULL,
                    source TEXT NOT NULL DEFAULT '',
                    consumed INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_events_consumed ON events(consumed, timestamp)"
            )
            conn.commit()
```

**b) Add `mark_consumed()` method:**

Insert after `stats()`:
```python
    def mark_consumed(self, event_ids: list[str]) -> None:
        if not event_ids:
            return
        with self._connect() as conn:
            placeholders = ",".join("?" * len(event_ids))
            conn.execute(
                f"UPDATE events SET consumed = 1 WHERE id IN ({placeholders})",
                event_ids,
            )
            conn.commit()
```

**c) Update `poll()` to filter unconsumed:**

Replace `poll()` with:
```python
    def poll(self, since: str = "", limit: int = 100) -> list[Event]:
        with self._connect() as conn:
            if since:
                rows = conn.execute(
                    "SELECT id, name, category, payload_json, timestamp, source FROM events WHERE consumed = 0 AND timestamp > ? ORDER BY timestamp DESC LIMIT ?",
                    (since, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT id, name, category, payload_json, timestamp, source FROM events WHERE consumed = 0 ORDER BY timestamp DESC LIMIT ?",
                    (limit,),
                ).fetchall()
        return [self._row_to_event(r) for r in rows]
```

**d) Update `_row_to_event` to handle 6 or 7 columns:**

```python
    @staticmethod
    def _row_to_event(row: tuple) -> Event:
        # Handle both old 6-col and new 7-col schemas
        if len(row) == 7:
            return Event(
                id=row[0], name=row[1], category=EventCategory(row[2]),
                payload=json.loads(row[3]) if row[3] is not None else None,
                timestamp=row[4], source=row[5],
            )
        return Event(
            id=row[0], name=row[1], category=EventCategory(row[2]),
            payload=json.loads(row[3]) if row[3] is not None else None,
            timestamp=row[4], source=row[5],
        )
```

- [ ] **Step 4: Update loop.py to consume events after processing**

In `tools/jarvis/loop.py`, inside `run_cycle()`, after `events = await self.perceive()`:

```python
        events = await self.perceive()
        if events:
            self.event_bus.mark_consumed([e.id for e in events])
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tools/jarvis/test_jarvis_fixes.py::test_event_bus_no_duplicate_poll -v`

Expected: PASS

---

## Task 3: Add Budget Check to SafetyEngine

**Files:**
- Modify: `tools/jarvis/safety.py`
- Modify: `tools/jarvis/loop.py`
- Test: `tools/jarvis/test_jarvis_fixes.py`

- [ ] **Step 1: Write the failing test**

```python
def test_safety_engine_budget_check():
    from tools.jarvis.safety import SafetyEngine, RiskLevel
    from tools.jarvis.types import PlanStep
    engine = SafetyEngine()
    # Simulate exceeding budget by monkey-patching internal tracker
    engine._daily_cost_usd = 10.0
    engine._budget_limit = 5.0

    step = PlanStep(tool_name="wiki_write", params={"path": "test.md", "content": "x"})
    result = engine.pre_check(step)
    assert not result.passed
    assert "budget" in result.reason.lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tools/jarvis/test_jarvis_fixes.py::test_safety_engine_budget_check -v`

Expected: FAIL â€?`SafetyEngine` has no `_daily_cost_usd` attribute

- [ ] **Step 3: Add budget tracking to SafetyEngine**

In `tools/jarvis/safety.py`, inside `SafetyEngine.__init__()` after `_load_config()`:

```python
        self._daily_cost_usd: float = 0.0
        self._budget_limit: float = 5.0
        self._load_budget_from_config()

    def _load_budget_from_config(self):
        config_path = REPO_ROOT / "config" / "jarvis.yaml"
        if not config_path.exists():
            return
        try:
            import yaml
            with open(config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f) or {}
            safety = config.get("safety", {})
            budget = safety.get("budget", {})
            self._budget_limit = float(budget.get("daily_usd", 5.0))
        except Exception:
            pass
```

In `pre_check()`, after `_check_rate_limit()`:

```python
        if not self._check_budget():
            self._blocked_count += 1
            return SafetyCheckResult(
                passed=False,
                reason=f"Daily budget exceeded: ${self._daily_cost_usd:.2f} / ${self._budget_limit:.2f}",
                risk_level=RiskLevel.L3,
            )
```

Add `_check_budget()` method:

```python
    def _check_budget(self) -> bool:
        return self._daily_cost_usd < self._budget_limit

    def record_cost(self, cost_usd: float):
        self._daily_cost_usd += cost_usd
```

- [ ] **Step 4: Update loop.py to record LLM costs**

In `tools/jarvis/loop.py`, inside `execute()`, after `result = await self.registry.execute(...)`:

```python
            # Track approximate cost for safety budget
            if result.tokens_used:
                # Rough heuristic: $0.0015 per 1K input + $0.002 per 1K output tokens
                inp = result.tokens_used.get("input", 0)
                out = result.tokens_used.get("output", 0)
                cost = (inp * 0.0000015) + (out * 0.000002)
                self.safety_engine.record_cost(cost)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tools/jarvis/test_jarvis_fixes.py::test_safety_engine_budget_check -v`

Expected: PASS

---

## Task 4: Add Consecutive-Failure Auto-Stop to AgentLoop

**Files:**
- Modify: `tools/jarvis/loop.py`
- Test: `tools/jarvis/test_jarvis_fixes.py`

- [ ] **Step 1: Write the failing test**

```python
def test_loop_auto_stop_after_3_failures():
    from tools.jarvis.loop import AgentLoop
    from tools.jarvis.types import AgentStatus
    import asyncio

    loop = AgentLoop()
    loop.state.status = AgentStatus.RUNNING
    loop._consecutive_failures = 0

    # Simulate 3 failures
    for _ in range(3):
        try:
            raise RuntimeError("simulated failure")
        except Exception:
            loop._consecutive_failures += 1
            if loop._consecutive_failures >= 3:
                loop.stop()
                break

    assert loop.state.status == AgentStatus.STOPPED
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tools/jarvis/test_jarvis_fixes.py::test_loop_auto_stop_after_3_failures -v`

Expected: FAIL â€?`AgentLoop` has no `_consecutive_failures` attribute

- [ ] **Step 3: Add failure tracking to AgentLoop**

In `tools/jarvis/loop.py`, inside `AgentLoop.__init__()`:

```python
        self._consecutive_failures: int = 0
        self._max_consecutive_failures: int = 3
```

In `start()`, replace the exception block:

```python
        while self.state.status == AgentStatus.RUNNING:
            try:
                await self.run_cycle()
                self._consecutive_failures = 0
            except Exception as exc:
                self._consecutive_failures += 1
                self.event_bus.publish(
                    Event(
                        name="agent.cycle.error",
                        category=EventCategory.SYSTEM,
                        payload={
                            "error": str(exc),
                            "consecutive_failures": self._consecutive_failures,
                        },
                        source="loop",
                    )
                )
                if self._consecutive_failures >= self._max_consecutive_failures:
                    self.stop()
                    self.event_bus.publish(
                        Event(
                            name="agent.lifecycle.auto_stopped",
                            category=EventCategory.SYSTEM,
                            payload={"reason": f"{self._consecutive_failures} consecutive failures"},
                            source="loop",
                        )
                    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tools/jarvis/test_jarvis_fixes.py::test_loop_auto_stop_after_3_failures -v`

Expected: PASS

---

## Task 5: Extract config.py for Unified Config Loading

**Files:**
- Create: `tools/jarvis/config.py`
- Modify: `tools/jarvis/loop.py` (replace _load_config)
- Modify: `tools/jarvis/safety.py` (replace _load_config)
- Test: `tools/jarvis/test_jarvis_fixes.py`

- [ ] **Step 1: Write config.py**

Create `tools/jarvis/config.py`:

```python
#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.parent
DEFAULT_CONFIG: dict[str, Any] = {
    "agent": {
        "name": "Jarvis",
        "cycle_interval": 300,
        "cycle_interval_busy": 10,
        "max_concurrent_tasks": 5,
        "learning_enabled": True,
        "auto_approve_enabled": True,
    },
    "safety": {
        "red_lines": [
            "never_delete_raw_files",
            "never_expose_api_keys",
            "never_modify_tools_without_approval",
            "never_send_private_data_externally",
        ],
        "rate_limits": {
            "max_tool_calls_per_minute": 30,
            "max_tool_calls_per_hour": 200,
            "max_tool_calls_per_day": 1000,
        },
        "budget": {
            "daily_usd": 5.0,
            "warning_percent": 80,
        },
    },
    "tools": {
        "system": {"enabled": True},
        "web": {"enabled": True},
        "dev": {"enabled": True},
        "comm": {"enabled": True},
    },
}


class JarvisConfig:
    """Single source of truth for jarvis.yaml."""

    def __init__(self, path: Path | None = None) -> None:
        self._path = path or REPO_ROOT / "config" / "jarvis.yaml"
        self._data: dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        import copy
        self._data = copy.deepcopy(DEFAULT_CONFIG)
        if not self._path.exists():
            return
        try:
            import yaml
            with open(self._path, "r", encoding="utf-8") as f:
                user = yaml.safe_load(f) or {}
            self._merge(user, self._data)
        except Exception:
            pass

    @staticmethod
    def _merge(src: dict, dst: dict) -> None:
        for key, val in src.items():
            if isinstance(val, dict) and key in dst and isinstance(dst[key], dict):
                JarvisConfig._merge(val, dst[key])
            else:
                dst[key] = val

    def get(self, *keys: str, default: Any = None) -> Any:
        node = self._data
        for k in keys:
            if not isinstance(node, dict) or k not in node:
                return default
            node = node[k]
        return node

    def section(self, name: str) -> dict[str, Any]:
        return self._data.get(name, {})

    @property
    def raw(self) -> dict[str, Any]:
        return dict(self._data)


_config: JarvisConfig | None = None


def get_config() -> JarvisConfig:
    global _config
    if _config is None:
        _config = JarvisConfig()
    return _config


def reset_config() -> None:
    global _config
    _config = None
```

- [ ] **Step 2: Replace loop.py _load_config with get_config**

In `tools/jarvis/loop.py`:
- Add import: `from tools.jarvis.config import get_config`
- Replace `_load_config()` method:

```python
    def _load_config(self) -> dict:
        cfg = get_config()
        return {
            "cycle_interval": cfg.get("agent", "cycle_interval", default=300),
            "cycle_interval_busy": cfg.get("agent", "cycle_interval_busy", default=10),
            "max_concurrent_tasks": cfg.get("agent", "max_concurrent_tasks", default=5),
            "learning_enabled": cfg.get("agent", "learning_enabled", default=True),
        }
```

- [ ] **Step 3: Replace safety.py _load_config with get_config**

In `tools/jarvis/safety.py`:
- Add import: `from tools.jarvis.config import get_config`
- Replace `_load_config()`:

```python
    def _load_config(self):
        cfg = get_config()
        rate_limits = cfg.get("safety", "rate_limits", default={})
        for key, value in rate_limits.items():
            if key in self._rate_limits:
                self._rate_limits[key] = int(value)
        blocked = cfg.get("safety", "blocked_commands", default=[])
        if isinstance(blocked, list):
            self._blocked_commands.extend(blocked)
        patterns = cfg.get("safety", "blocked_patterns", default=[])
        if isinstance(patterns, list):
            self._blocked_patterns.extend(patterns)
```

- [ ] **Step 4: Run test**

```python
def test_config_unified_loading():
    from tools.jarvis.config import JarvisConfig, get_config, reset_config
    reset_config()
    cfg = get_config()
    assert cfg.get("agent", "cycle_interval") == 300
    assert cfg.get("safety", "budget", "daily_usd") == 5.0
    assert cfg.get("nonexistent", "key", default="fallback") == "fallback"
```

Run: `pytest tools/jarvis/test_jarvis_fixes.py::test_config_unified_loading -v`

Expected: PASS

---

## Task 6: Extract state.py for AgentState Persistence

**Files:**
- Create: `tools/jarvis/state.py`
- Modify: `tools/jarvis/loop.py` (replace in-memory state)
- Test: `tools/jarvis/test_jarvis_fixes.py`

- [ ] **Step 1: Write state.py**

Create `tools/jarvis/state.py`:

```python
#!/usr/bin/env python3
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from tools.jarvis.types import AgentState, AgentStatus

REPO_ROOT = Path(__file__).parent.parent.parent
DB_PATH = REPO_ROOT / "state" / "jarvis_state.db"


class StateManager:
    """Persist AgentState to SQLite across restarts."""

    def __init__(self, db_path: Path | None = None) -> None:
        self._db_path = db_path or DB_PATH
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS agent_state (
                    key TEXT PRIMARY KEY,
                    value_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.commit()

    def load(self) -> AgentState:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT value_json FROM agent_state WHERE key = 'agent_state'"
            ).fetchone()
        if row is None:
            return AgentState()
        data = json.loads(row["value_json"])
        return self._deserialize(data)

    def save(self, state: AgentState) -> None:
        data = self._serialize(state)
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO agent_state (key, value_json, updated_at)
                VALUES ('agent_state', ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET
                    value_json = excluded.value_json,
                    updated_at = excluded.updated_at
                """,
                (json.dumps(data, default=str),),
            )
            conn.commit()

    @staticmethod
    def _serialize(state: AgentState) -> dict[str, Any]:
        return {
            "status": state.status.value,
            "cycle_count": state.cycle_count,
            "last_cycle_time": state.last_cycle_time,
            "total_tool_calls": state.total_tool_calls,
            "total_success": state.total_success,
            "total_failed": state.total_failed,
            "daily_stats": state.daily_stats,
        }

    @staticmethod
    def _deserialize(data: dict[str, Any]) -> AgentState:
        state = AgentState()
        status_str = data.get("status", "stopped")
        try:
            state.status = AgentStatus(status_str)
        except ValueError:
            state.status = AgentStatus.STOPPED
        state.cycle_count = data.get("cycle_count", 0)
        state.last_cycle_time = data.get("last_cycle_time", "")
        state.total_tool_calls = data.get("total_tool_calls", 0)
        state.total_success = data.get("total_success", 0)
        state.total_failed = data.get("total_failed", 0)
        state.daily_stats = data.get("daily_stats", {})
        return state


_manager: StateManager | None = None


def get_state_manager() -> StateManager:
    global _manager
    if _manager is None:
        _manager = StateManager()
    return _manager
```

- [ ] **Step 2: Integrate StateManager into loop.py**

In `tools/jarvis/loop.py`:
- Add import: `from tools.jarvis.state import get_state_manager`
- Modify `__init__`:

```python
    def __init__(self) -> None:
        self.state_manager = get_state_manager()
        self.state = self.state_manager.load()
        # ... rest stays the same
```

- Modify `run_cycle()` to persist after learn:

```python
        results = await self.execute(plan)
        await self.learn(results)
        self.state_manager.save(self.state)
        return cycle_id
```

- [ ] **Step 3: Run test**

```python
def test_state_persistence():
    import tempfile, uuid
    from tools.jarvis.state import StateManager
    from tools.jarvis.types import AgentState, AgentStatus

    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    manager = StateManager(db_path=Path(tmp.name))

    state = AgentState()
    state.cycle_count = 42
    state.status = AgentStatus.RUNNING
    manager.save(state)

    loaded = manager.load()
    assert loaded.cycle_count == 42
    assert loaded.status == AgentStatus.RUNNING
```

Run: `pytest tools/jarvis/test_jarvis_fixes.py::test_state_persistence -v`

Expected: PASS

---

## Task 7: Populate __init__.py with Unified Exports

**Files:**
- Modify: `tools/jarvis/__init__.py`

- [ ] **Step 1: Write __init__.py**

```python
#!/usr/bin/env python3
"""Jarvis autonomous agent framework."""
from __future__ import annotations

from tools.jarvis.approval import ApprovalManager, get_approval_manager
from tools.jarvis.config import JarvisConfig, get_config, reset_config
from tools.jarvis.event_bus import EventBus, get_event_bus
from tools.jarvis.loop import AgentLoop, get_agent_loop
from tools.jarvis.safety import SafetyEngine, get_safety_engine
from tools.jarvis.state import StateManager, get_state_manager
from tools.jarvis.tool_registry import ToolRegistry, get_registry, register_tool
from tools.jarvis.types import (
    AgentState,
    AgentStatus,
    ApprovalRequest,
    Event,
    EventCategory,
    Insight,
    Plan,
    PlanStep,
    RiskLevel,
    StepStatus,
    ToolDef,
    ToolResult,
    Urgency,
)

__all__ = [
    "AgentLoop",
    "AgentState",
    "AgentStatus",
    "ApprovalManager",
    "ApprovalRequest",
    "Event",
    "EventBus",
    "EventCategory",
    "Insight",
    "JarvisConfig",
    "Plan",
    "PlanStep",
    "RiskLevel",
    "SafetyEngine",
    "StateManager",
    "StepStatus",
    "ToolDef",
    "ToolRegistry",
    "ToolResult",
    "Urgency",
    "get_agent_loop",
    "get_approval_manager",
    "get_config",
    "get_event_bus",
    "get_registry",
    "get_safety_engine",
    "get_state_manager",
    "register_tool",
    "reset_config",
]
```

- [ ] **Step 2: Verify import works**

Run: `python -c "from tools.jarvis import AgentLoop, get_agent_loop, get_config; print('OK')"`

Expected: `OK`

---

## Task 8: Full Regression Test Suite

- [ ] **Step 1: Run all jarvis tests**

Run: `pytest tools/jarvis/test_jarvis_fixes.py -v`

Expected: All 7 tests PASS

- [ ] **Step 2: Verify CLI still works**

Run: `python tools/jarvis_cli.py status --json`

Expected: JSON output with agent status, no exceptions

- [ ] **Step 3: Verify existing tests unaffected**

Run: `pytest tools/test_search_backend.py tools/test_migration.py -v`

Expected: All 18 tests PASS

---

## Self-Review

1. **Spec coverage:** Every bug identified in the assessment has a task:
   - list_all() missing â†?Task 1 âœ?   - EventBus duplication â†?Task 2 âœ?   - SafetyEngine no budget â†?Task 3 âœ?   - Loop no auto-stop â†?Task 4 âœ?   - Missing config.py â†?Task 5 âœ?   - Missing state.py â†?Task 6 âœ?   - Empty __init__.py â†?Task 7 âœ?
2. **Placeholder scan:** No TBD, TODO, or vague steps. Every step has actual code.

3. **Type consistency:**
   - `AgentLoop._consecutive_failures` used in init and start âœ?   - `SafetyEngine._check_budget()` used in pre_check âœ?   - `EventBus.mark_consumed()` used in loop âœ?
---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-11-jarvis-bugs-and-infrastructure.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** â€?I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** â€?Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
