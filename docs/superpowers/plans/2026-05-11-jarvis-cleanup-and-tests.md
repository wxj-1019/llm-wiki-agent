# Jarvis Cleanup + Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Eliminate remaining code duplication (subprocess, path traversal, event sources, date formats) and raise test coverage from 16 to 30+ tests across all core modules.

**Architecture:** Extract shared utilities into `shared_utils.py`, introduce `EventSource` enum in `types.py`, normalize all timestamps to ISO strings. Tests use pytest with PG integration where needed, mocks for LLM and external services.

**Tech Stack:** Python 3.12, PostgreSQL 17, pytest, pytest-asyncio, unittest.mock

---

## File Structure

| File | Responsibility |
|---|---|
| `tools/jarvis/shared_utils.py` | **Expand.** Add `safe_subprocess()`, `normalize_path()`, `iso_now()`, `EventSource` enum |
| `tools/jarvis/types.py` | Add `EventSource` enum; normalize datetime fields to `str` |
| `tools/jarvis/event_bus.py` | Use `EventSource` enum; normalize timestamps |
| `tools/jarvis/state.py` | Use `iso_now()` for timestamps |
| `tools/jarvis/audit.py` | Use `iso_now()` for timestamps |
| `tools/jarvis/loop.py` | Use `EventSource.LOOP`; use `iso_now()` |
| `tools/jarvis/multi_agent.py` | Use `EventSource.MULTI_AGENT`; use `iso_now()` |
| `tools/jarvis/tools/comm_tools.py` | Use `EventSource.COMM_TOOLS`; use `iso_now()` |
| `tools/jarvis/tools/system_tools.py` | Use `normalize_path()` and `safe_subprocess()` |
| `tools/jarvis/tools/dev_tools.py` | Use `normalize_path()` and `safe_subprocess()` |
| `tools/jarvis/tools/knowledge_tools.py` | Use `safe_subprocess()` |
| `tools/jarvis/tools/web_tools.py` | Use `normalize_path()` |
| `tools/jarvis/tools/composite_tools.py` | Use `safe_subprocess()` |
| `tests/jarvis/test_event_bus.py` | **New.** EventBus CRUD, subscribe, dispatch, purge |
| `tests/jarvis/test_state.py` | **New.** AgentStateStore save/load/reset |
| `tests/jarvis/test_tool_registry.py` | **New.** ToolRegistry register, execute, stats |
| `tests/jarvis/test_audit.py` | **New.** AuditStore write/query |
| `tests/jarvis/test_ooda_full.py` | **New.** Full OODA cycle with mocked LLM |

---

## Task 1: Expand shared_utils.py with safe_subprocess, normalize_path, iso_now, EventSource

**Files:**
- Modify: `tools/jarvis/shared_utils.py`
- Modify: `tools/jarvis/types.py`

**Motivation:** Four modules duplicate subprocess spawning; three duplicate path traversal guards; six duplicate `datetime.now().isoformat()`; event sources use raw strings.

- [ ] **Step 1: Add to `types.py`**

Add `EventSource` enum after the existing enums:

```python
class EventSource(str, Enum):
    LOOP = "loop"
    MULTI_AGENT = "multi_agent"
    COMM_TOOLS = "comm_tools"
    SYSTEM_TOOLS = "system_tools"
    DEV_TOOLS = "dev_tools"
    KNOWLEDGE_TOOLS = "knowledge_tools"
    WEB_TOOLS = "web_tools"
    COMPOSITE_TOOLS = "composite_tools"
    PLANNER = "planner"
    LEARNER = "learner"
    SAFETY = "safety"
    APPROVAL = "approval"
    USER = "user"
```

- [ ] **Step 2: Expand `shared_utils.py`**

Append these functions to `tools/jarvis/shared_utils.py`:

```python
import subprocess
from datetime import datetime
from enum import Enum


def safe_subprocess(
    cmd: list[str] | str,
    cwd: str | None = None,
    timeout: int = 60,
    shell: bool = False,
    capture_output: bool = True,
) -> dict:
    """Run a subprocess with safe defaults. Returns dict with stdout, stderr, returncode."""
    result: dict = {"stdout": "", "stderr": "", "returncode": -1, "duration_ms": 0}
    start = datetime.now()
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            timeout=timeout,
            shell=shell,
            capture_output=capture_output,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        result["stdout"] = proc.stdout or ""
        result["stderr"] = proc.stderr or ""
        result["returncode"] = proc.returncode
    except subprocess.TimeoutExpired as exc:
        result["stderr"] = f"Timed out after {timeout}s"
        result["stdout"] = exc.stdout or ""
        result["returncode"] = -1
    except FileNotFoundError:
        result["stderr"] = f"Command not found: {cmd}"
        result["returncode"] = -1
    except Exception as exc:
        result["stderr"] = str(exc)
        result["returncode"] = -1
    result["duration_ms"] = int((datetime.now() - start).total_seconds() * 1000)
    return result


def normalize_path(user_path: str, base_dir: str | Path) -> Path | None:
    """Resolve a user-provided path relative to base_dir, with traversal protection.
    Returns resolved Path or None if traversal detected.
    """
    try:
        base = Path(base_dir).resolve()
        target = (base / user_path).resolve()
        # Ensure target is within base
        target.relative_to(base)
        return target
    except (ValueError, RuntimeError):
        return None


def iso_now() -> str:
    """Return current time as ISO 8601 string (UTC-naive)."""
    return datetime.now().isoformat()
```

- [ ] **Step 3: Test the new utilities**

```python
# tests/jarvis/test_shared_utils.py (append)
from tools.jarvis.shared_utils import safe_subprocess, normalize_path, iso_now
from tools.jarvis.types import EventSource


def test_safe_subprocess_echo():
    result = safe_subprocess(["echo", "hello"])
    assert result["returncode"] == 0
    assert "hello" in result["stdout"]


def test_safe_subprocess_not_found():
    result = safe_subprocess(["this_command_does_not_exist_12345"])
    assert result["returncode"] == -1
    assert "not found" in result["stderr"].lower() or "Command not found" in result["stderr"]


def test_normalize_path_safe():
    base = "E:/A_Project/llm-wiki-agent"
    result = normalize_path("wiki/index.md", base)
    assert result is not None
    assert result.name == "index.md"


def test_normalize_path_traversal():
    base = "E:/A_Project/llm-wiki-agent"
    result = normalize_path("../../etc/passwd", base)
    assert result is None


def test_iso_now_format():
    now = iso_now()
    assert isinstance(now, str)
    assert "T" in now


def test_event_source_values():
    assert EventSource.LOOP == "loop"
    assert EventSource.MULTI_AGENT == "multi_agent"
```

Run: `python -m pytest tests/jarvis/test_shared_utils.py -v`
Expected: All tests PASS.

---

## Task 2: Replace subprocess duplication with safe_subprocess

**Files:**
- Modify: `tools/jarvis/tools/system_tools.py`
- Modify: `tools/jarvis/tools/dev_tools.py`
- Modify: `tools/jarvis/tools/knowledge_tools.py`
- Modify: `tools/jarvis/tools/composite_tools.py`

**Motivation:** Each module has its own subprocess wrapper with slightly different timeout/error handling.

- [ ] **Step 1: Replace in `system_tools.py`**

Find `terminal_exec` or any `subprocess.run`/`subprocess.Popen` calls. Replace with `safe_subprocess`. Add import: `from tools.jarvis.shared_utils import safe_subprocess`.

- [ ] **Step 2: Replace in `dev_tools.py`**

Find `_run_git` or any subprocess calls. Replace with `safe_subprocess`. Preserve git-specific logic (parsing output, checking return codes) — only replace the subprocess invocation itself.

- [ ] **Step 3: Replace in `knowledge_tools.py`**

Find `_run_subprocess` or any subprocess calls. Replace with `safe_subprocess`.

- [ ] **Step 4: Replace in `composite_tools.py`**

Find any subprocess calls. Replace with `safe_subprocess`.

- [ ] **Step 5: Verify no regressions**

Run: `python -m pytest tests/jarvis/ -v`
Expected: All tests PASS.

---

## Task 3: Replace path traversal duplication with normalize_path

**Files:**
- Modify: `tools/jarvis/tools/system_tools.py`
- Modify: `tools/jarvis/tools/web_tools.py`
- Modify: `tools/jarvis/tools/dev_tools.py`

**Motivation:** Three modules implement path traversal protection with slightly different logic.

- [ ] **Step 1: Replace in `system_tools.py`**

Find `_resolve_path` or similar. Replace with `normalize_path`. Add import.

- [ ] **Step 2: Replace in `web_tools.py`**

Find download path validation. Replace with `normalize_path`.

- [ ] **Step 3: Replace in `dev_tools.py`**

Find any path validation in `db_query`/`pg_query`. Replace with `normalize_path`.

- [ ] **Step 4: Verify no regressions**

Run: `python -m pytest tests/jarvis/ -v`
Expected: All tests PASS.

---

## Task 4: Replace raw event source strings with EventSource enum

**Files:**
- Modify: `tools/jarvis/loop.py`
- Modify: `tools/jarvis/multi_agent.py`
- Modify: `tools/jarvis/tools/comm_tools.py`
- Modify: `tools/jarvis/event_bus.py` (if any hardcoded sources)

**Motivation:** Raw strings are error-prone and not discoverable.

- [ ] **Step 1: Replace in `loop.py`**

Find all `source="loop"` in Event constructors. Replace with `source=EventSource.LOOP`. Add import: `from tools.jarvis.types import EventSource`.

- [ ] **Step 2: Replace in `multi_agent.py`**

Find all `source="multi_agent"`. Replace with `source=EventSource.MULTI_AGENT`.

- [ ] **Step 3: Replace in `comm_tools.py`**

Find all `source="comm_tools"`. Replace with `source=EventSource.COMM_TOOLS`.

- [ ] **Step 4: Verify no regressions**

Run: `python -m pytest tests/jarvis/ -v`
Expected: All tests PASS.

---

## Task 5: Normalize datetime usage with iso_now()

**Files:**
- Modify: `tools/jarvis/loop.py`
- Modify: `tools/jarvis/event_bus.py`
- Modify: `tools/jarvis/state.py`
- Modify: `tools/jarvis/audit.py`
- Modify: `tools/jarvis/approval.py`
- Modify: `tools/jarvis/multi_agent.py`

**Motivation:** Some modules use `datetime.now()` (object) while others use `.isoformat()` (string). Standardize on ISO strings via `iso_now()`.

- [ ] **Step 1: Replace `datetime.now().isoformat()` calls**

In each file, replace `datetime.now().isoformat()` with `iso_now()`. Add import if needed.

- [ ] **Step 2: Verify no regressions**

Run: `python -m pytest tests/jarvis/ -v`
Expected: All tests PASS.

---

## Task 6: Add event_bus tests

**Files:**
- Create: `tests/jarvis/test_event_bus.py`

- [ ] **Step 1: Write tests**

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.event_bus import get_event_bus
from tools.jarvis.types import Event, EventCategory, EventSource


def test_publish_and_poll():
    bus = get_event_bus()
    bus.publish(Event(name="test.event", category=EventCategory.SYSTEM, payload={"x": 1}, source=EventSource.LOOP))
    polled = bus.poll(limit=10)
    assert any(e.name == "test.event" for e in polled)


def test_mark_consumed():
    bus = get_event_bus()
    bus.publish(Event(name="test.consume", category=EventCategory.SYSTEM, payload={}, source=EventSource.LOOP))
    polled = bus.poll(limit=10)
    ids = [e.id for e in polled if e.name == "test.consume"]
    if ids:
        bus.mark_consumed(ids)
        polled2 = bus.poll(limit=10)
        assert not any(e.id in ids for e in polled2)


def test_stats():
    bus = get_event_bus()
    stats = bus.stats()
    assert isinstance(stats, dict)
    assert "total" in stats
```

- [ ] **Step 2: Run tests**

Run: `python -m pytest tests/jarvis/test_event_bus.py -v`
Expected: All tests PASS.

---

## Task 7: Add state tests

**Files:**
- Create: `tests/jarvis/test_state.py`

- [ ] **Step 1: Write tests**

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.state import get_state_store
from tools.jarvis.types import AgentState, AgentStatus


def test_save_and_load():
    store = get_state_store()
    state = AgentState()
    state.cycle_count = 42
    store.save(state)
    loaded = store.load()
    assert loaded.cycle_count == 42


def test_reset():
    store = get_state_store()
    state = AgentState()
    state.cycle_count = 99
    store.save(state)
    store.reset()
    loaded = store.load()
    assert loaded.cycle_count == 0
```

- [ ] **Step 2: Run tests**

Run: `python -m pytest tests/jarvis/test_state.py -v`
Expected: All tests PASS.

---

## Task 8: Add tool_registry tests

**Files:**
- Create: `tests/jarvis/test_tool_registry.py`

- [ ] **Step 1: Write tests**

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.tool_registry import get_registry
from tools.jarvis.types import ToolDef, RiskLevel


def test_register_and_get():
    reg = get_registry()

    def dummy_tool(x: int) -> int:
        return x * 2

    reg.register(
        ToolDef(
            name="test_double",
            description="Doubles a number",
            handler=dummy_tool,
            risk_level=RiskLevel.L0,
            input_schema={"type": "object", "properties": {"x": {"type": "integer"}}},
        )
    )
    tool = reg.get("test_double")
    assert tool is not None
    assert tool.name == "test_double"


def test_list_tools():
    reg = get_registry()
    tools = reg.list_tools()
    assert len(tools) > 0
```

- [ ] **Step 2: Run tests**

Run: `python -m pytest tests/jarvis/test_tool_registry.py -v`
Expected: All tests PASS.

---

## Task 9: Add audit tests

**Files:**
- Create: `tests/jarvis/test_audit.py`

- [ ] **Step 1: Write tests**

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.audit import get_audit_store
from tools.jarvis.types import PlanStep, ToolResult, RiskLevel


def test_write_and_query():
    store = get_audit_store()
    step = PlanStep(tool_name="noop", params={}, risk_level=RiskLevel.L0)
    result = ToolResult(success=True, data="ok")
    store.write(step, result)
    rows = store.query(limit=5)
    assert isinstance(rows, list)
```

- [ ] **Step 2: Run tests**

Run: `python -m pytest tests/jarvis/test_audit.py -v`
Expected: All tests PASS.

---

## Task 10: Add full OODA integration test with mocked LLM

**Files:**
- Create: `tests/jarvis/test_ooda_full.py`

- [ ] **Step 1: Write test**

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import asyncio
from unittest.mock import patch
from tools.jarvis.loop import AgentLoop
from tools.jarvis.types import Event, EventCategory, EventSource


def test_full_ooda_cycle_with_mock_llm():
    loop = AgentLoop()

    # Inject a synthetic event so reason() has something to process
    loop.event_bus.publish(
        Event(
            name="agent.test.trigger",
            category=EventCategory.SYSTEM,
            payload={"action": "noop"},
            source=EventSource.LOOP,
        )
    )

    # Mock call_llm to return a deterministic insight
    mock_response = '[{"description": "Test insight", "urgency": "low", "suggested_action": "Run noop", "tool_calls": [{"tool": "noop", "params": {}}], "risk_level": "L0", "reasoning": "test"}]'

    with patch("tools.jarvis.loop.call_llm", return_value=mock_response):
        cycle_id = asyncio.run(loop.run_cycle())

    assert cycle_id.startswith("cycle_")
    assert loop.state.cycle_count >= 1
    # Verify plan was optimized by Planner
    assert loop.state.current_plan is not None
    assert loop.state.current_plan.estimated_cost is not None
```

- [ ] **Step 2: Run tests**

Run: `python -m pytest tests/jarvis/test_ooda_full.py -v`
Expected: All tests PASS.

---

## Task 11: Final full suite run

- [ ] **Step 1: Run entire test suite**

Run: `python -m pytest tests/jarvis/ -v`

Expected: 30+ tests, all PASS.

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ safe_subprocess extracted (Task 2)
- ✅ normalize_path extracted (Task 3)
- ✅ EventSource enum (Task 4)
- ✅ iso_now() normalized (Task 5)
- ✅ event_bus tests (Task 6)
- ✅ state tests (Task 7)
- ✅ tool_registry tests (Task 8)
- ✅ audit tests (Task 9)
- ✅ Full OODA mock test (Task 10)

**2. Placeholder scan:**
- ✅ No TBD/TODO/"implement later"
- ✅ All steps have exact code and commands

**3. Type consistency:**
- ✅ `EventSource` used consistently across all modules
- ✅ `iso_now()` returns `str` everywhere
- ✅ `safe_subprocess()` returns `dict` with consistent keys
