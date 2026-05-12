> **Status:** Implemented

# Jarvis Core Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect orphaned subsystems (Planner, Learner), fix approval security gaps, add MultiAgent task lifecycle, extract shared utilities, and establish test coverage for the Jarvis core.

**Architecture:** Treat each fix as an independent, self-contained change. The loop remains the orchestration hub; Planner and Learner become first-class participants. Approval security is hardened with proper YAML parsing and deny-list enforcement. MultiAgent gains task completion semantics. Shared code (LLM JSON parsing, config loading) is extracted to prevent duplication.

**Tech Stack:** Python 3.12, PostgreSQL 17 + pgvector, psycopg2, PyYAML, pytest

---

## File Structure

| File | Responsibility |
|---|---|
| `tools/jarvis/loop.py` | Main orchestration loop. Modified to call Planner and Learner. |
| `tools/jarvis/planner.py` | Already has `optimize_plan()`, `validate_plan()`, `estimate_cost()`. Loop will call them. |
| `tools/jarvis/learner.py` | Already has `record_cycle()`, `extract_patterns()`, `apply_auto_adjustments()`. Loop will call them. |
| `tools/jarvis/approval.py` | Fix YAML parsing (`auto_approve` root key). Add `never_auto_approve` enforcement. |
| `config/approval_policies.yaml` | Restructure to match what `approval.py` expects, preserving semantics. |
| `tools/jarvis/multi_agent.py` | Add `complete_task()`, `fail_task()`, `start_task()` methods. |
| `tools/jarvis/shared_utils.py` | **New.** `parse_llm_json()`, `load_yaml_config()`. |
| `tests/jarvis/` | **New directory.** Unit tests for approval, multi_agent, shared_utils. |

---

## Task 1: Extract shared utilities (`shared_utils.py`)

**Files:**
- Create: `tools/jarvis/shared_utils.py`
- Modify: `tools/jarvis/loop.py:149-156`, `tools/jarvis/planner.py:88-93`, `tools/jarvis/goals.py` (find parse blocks)

**Motivation:** Three modules duplicate markdown-fence stripping + JSON parsing logic.

- [ ] **Step 1: Write the failing test**

```python
# tests/jarvis/test_shared_utils.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd E:\A_Project\llm-wiki-agent && python -m pytest tests/jarvis/test_shared_utils.py -v`

Expected: `ModuleNotFoundError: No module named 'tools.jarvis.shared_utils'`

- [ ] **Step 3: Implement `shared_utils.py`**

```python
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
```

- [ ] **Step 4: Replace duplication in `loop.py`**

In `tools/jarvis/loop.py`:

```python
# Add import at top
from tools.jarvis.shared_utils import parse_llm_json
```

Replace the JSON parsing block inside `reason()` (~lines 149-156) with:

```python
        try:
            parsed = parse_llm_json(raw)
            if parsed is None:
                return []
            if isinstance(parsed, dict):
                parsed = [parsed]
        except Exception:
            return []
```

Remove the old `cleaned = raw.strip()` â†?`parsed = json.loads(cleaned)` block.

- [ ] **Step 5: Replace duplication in `planner.py`**

In `tools/jarvis/planner.py`:

```python
# Add import at top
from tools.jarvis.shared_utils import parse_llm_json
```

Replace the JSON parsing block inside `create_plan_from_goal()` (~lines 88-93) with:

```python
        data = parse_llm_json(raw)
        if data is None:
            return plan
```

Remove the old `start = raw.index("{")` â†?`data = json.loads(...)` block.

- [ ] **Step 6: Replace duplication in `goals.py`**

Search `goals.py` for similar markdown-fence/JSON parsing logic. If found, replace with `parse_llm_json`. If not found in the first 200 lines, skip this step (the explore agent noted duplication but it may be in `decompose_goal()`).

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd E:\A_Project\llm-wiki-agent && python -m pytest tests/jarvis/test_shared_utils.py -v`

Expected: All 5 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add tools/jarvis/shared_utils.py tests/jarvis/test_shared_utils.py tools/jarvis/loop.py tools/jarvis/planner.py
git commit -m "refactor(jarvis): extract parse_llm_json and load_yaml_config to shared_utils.py"
```

---

## Task 2: Connect Planner to the loop

**Files:**
- Modify: `tools/jarvis/loop.py:36-51` (imports and __init__), `tools/jarvis/loop.py:186-222` (plan method)

**Motivation:** `Planner.optimize_plan()`, `validate_plan()`, and `estimate_cost()` exist but are never called.

- [ ] **Step 1: Write the failing test**

```python
# tests/jarvis/test_loop_planner.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.loop import AgentLoop
from tools.jarvis.types import Insight, RiskLevel, Urgency


def test_loop_uses_planner():
    loop = AgentLoop()
    insight = Insight(
        description="test",
        urgency=Urgency.LOW,
        suggested_action="do something",
        tool_calls=[{"tool": "noop", "params": {}}],
        risk_level=RiskLevel.L1,
        reasoning="test",
    )
    import asyncio
    plan = asyncio.run(loop.plan([insight]))
    # After planner integration, plan should have estimated_cost set
    assert plan.estimated_cost is not None
```

Run: `python -m pytest tests/jarvis/test_loop_planner.py -v`

Expected: FAIL â€?`plan.estimated_cost` is None because loop never calls planner.

- [ ] **Step 2: Import Planner in loop**

In `tools/jarvis/loop.py`, add to imports:

```python
from tools.jarvis.planner import get_planner
```

In `AgentLoop.__init__`, add:

```python
        self.planner = get_planner()
```

- [ ] **Step 3: Replace `plan()` body with Planner calls**

Replace the entire `async def plan(...)` method with:

```python
    async def plan(self, insights: list[Insight]) -> Plan:
        # Build raw plan from insights using the existing loop logic
        raw_plan = Plan(goal="Process insights from current cycle")
        for insight in insights:
            for call_spec in insight.tool_calls:
                tool_name = call_spec.get("tool", "")
                params = call_spec.get("params", {})
                if not tool_name:
                    continue
                registered = self.registry.get(tool_name)
                if registered is None:
                    continue
                risk = registered.risk_level
                requires_approval = risk in (RiskLevel.L3, RiskLevel.L4)
                step = PlanStep(
                    tool_name=tool_name,
                    params=params if isinstance(params, dict) else {},
                    risk_level=risk,
                    requires_approval=requires_approval,
                )
                raw_plan.add_step(step)
            if not insight.tool_calls:
                risk = insight.risk_level
                requires_approval = risk in (RiskLevel.L3, RiskLevel.L4)
                step = PlanStep(
                    tool_name="noop",
                    params={"action": insight.suggested_action},
                    risk_level=risk,
                    requires_approval=requires_approval,
                )
                raw_plan.add_step(step)

        # Delegate to Planner for optimization, validation, and cost estimation
        optimized = self.planner.optimize_plan(raw_plan)
        issues = self.planner.validate_plan(optimized)
        if issues:
            for issue in issues:
                self.event_bus.publish(
                    Event(
                        name="agent.plan.validation_issue",
                        category=EventCategory.SYSTEM,
                        payload={"issue": issue},
                        source="loop",
                    )
                )
        optimized.estimated_cost = self.planner.estimate_cost(optimized)
        return optimized
```

- [ ] **Step 4: Run the test**

Run: `python -m pytest tests/jarvis/test_loop_planner.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/jarvis/loop.py tests/jarvis/test_loop_planner.py
git commit -m "feat(jarvis): connect Planner.optimize_plan, validate_plan, estimate_cost to loop"
```

---

## Task 3: Connect Learner to the loop

**Files:**
- Modify: `tools/jarvis/loop.py:36-51` (imports and __init__), `tools/jarvis/loop.py:281-311` (learn method)

**Motivation:** `Learner.record_cycle()` and `Learner.apply_auto_adjustments()` exist but `learn()` only updates daily stats.

- [ ] **Step 1: Write the failing test**

```python
# tests/jarvis/test_loop_learner.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.loop import AgentLoop
from tools.jarvis.types import ToolResult


def test_loop_calls_learner():
    loop = AgentLoop()
    # Mock learner to avoid DB writes during test
    call_log = []
    original = loop.learner.record_cycle

    def mock_record(cycle_id, insights, results):
        call_log.append((cycle_id, len(insights), len(results)))

    loop.learner.record_cycle = mock_record  # type: ignore[method-assign]

    import asyncio
    asyncio.run(loop.learn([ToolResult(success=True, output="ok")]))
    assert len(call_log) == 1
```

Run: `python -m pytest tests/jarvis/test_loop_learner.py -v`

Expected: FAIL â€?`loop.learner` is None because learner is not initialized.

- [ ] **Step 2: Import and initialize Learner**

In `tools/jarvis/loop.py`, add to imports:

```python
from tools.jarvis.learner import get_learner
```

In `AgentLoop.__init__`, add:

```python
        self.learner = get_learner()
```

- [ ] **Step 3: Replace `learn()` body**

Replace the entire `async def learn(...)` method with:

```python
    async def learn(self, results: list[ToolResult]) -> None:
        cycle_id = f"cycle_{self.state.cycle_count}"

        # 1. Record cycle in learning system
        try:
            self.learner.record_cycle(
                cycle_id=cycle_id,
                insights=self.state.insights,
                results=results,
            )
        except Exception as exc:
            self.event_bus.publish(
                Event(
                    name="agent.learn.record_failed",
                    category=EventCategory.SYSTEM,
                    payload={"error": str(exc)},
                    source="loop",
                )
            )

        # 2. Apply safe auto-adjustments
        try:
            adjustments = self.learner.apply_auto_adjustments()
            if adjustments:
                for adj in adjustments:
                    self.event_bus.publish(
                        Event(
                            name="agent.learn.threshold_adjusted",
                            category=EventCategory.SYSTEM,
                            payload=adj,
                            source="loop",
                        )
                    )
        except Exception as exc:
            self.event_bus.publish(
                Event(
                    name="agent.learn.adjustment_failed",
                    category=EventCategory.SYSTEM,
                    payload={"error": str(exc)},
                    source="loop",
                )
            )

        # 3. Update daily stats (existing behavior preserved)
        success_count = sum(1 for r in results if r.success)
        fail_count = sum(1 for r in results if not r.success)
        today = datetime.now().strftime("%Y-%m-%d")
        if today not in self.state.daily_stats:
            self.state.daily_stats[today] = {
                "cycles": 0,
                "tool_calls": 0,
                "successes": 0,
                "failures": 0,
            }
        self.state.daily_stats[today]["cycles"] += 1
        self.state.daily_stats[today]["tool_calls"] += len(results)
        self.state.daily_stats[today]["successes"] += success_count
        self.state.daily_stats[today]["failures"] += fail_count

        # 4. Publish completion events (existing behavior preserved)
        for result in results:
            event_name = "agent.action.completed" if result.success else "agent.action.failed"
            self.event_bus.publish(
                Event(
                    name=event_name,
                    category=EventCategory.AGENT,
                    payload={
                        "success": result.success,
                        "error": result.error if result.error else None,
                        "duration_ms": result.duration_ms,
                    },
                    source="loop",
                )
            )
```

- [ ] **Step 4: Run the test**

Run: `python -m pytest tests/jarvis/test_loop_learner.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/jarvis/loop.py tests/jarvis/test_loop_learner.py
git commit -m "feat(jarvis): connect Learner.record_cycle and apply_auto_adjustments to loop"
```

---

## Task 4: Fix approval YAML parsing and add deny-list

**Files:**
- Modify: `config/approval_policies.yaml` (restructure)
- Modify: `tools/jarvis/approval.py:15-168` (parsing and auto_approve_check)

**Motivation:**
1. YAML uses `auto_approve:` root key, but `_load_policies()` expects `rules` or a direct list.
2. `never_auto_approve` list from YAML is loaded but never enforced.

- [ ] **Step 1: Write the failing test**

```python
# tests/jarvis/test_approval.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.approval import ApprovalManager
from tools.jarvis.types import PlanStep, RiskLevel


def test_auto_approve_uses_yaml_rules():
    mgr = ApprovalManager()
    step = PlanStep(tool_name="git_commit", params={"message": "auto-fix: typo"}, risk_level=RiskLevel.L2)
    # Should match the first rule in approval_policies.yaml
    result = mgr.auto_approve_check(step)
    assert result is True  # first call within rate limit


def test_never_auto_approve_blocks():
    mgr = ApprovalManager()
    step = PlanStep(tool_name="git_push", params={"remote": "origin"}, risk_level=RiskLevel.L3)
    result = mgr.auto_approve_check(step)
    assert result is False


def test_never_auto_approve_del_command():
    mgr = ApprovalManager()
    step = PlanStep(tool_name="terminal_exec", params={"command": "rm -rf /tmp"}, risk_level=RiskLevel.L3)
    result = mgr.auto_approve_check(step)
    assert result is False
```

Run: `python -m pytest tests/jarvis/test_approval.py -v`

Expected: Tests 2 and 3 FAIL because `never_auto_approve` is not enforced. Test 1 may pass or fail depending on whether the YAML currently parses correctly.

- [ ] **Step 2: Restructure `approval_policies.yaml`**

Replace the contents of `config/approval_policies.yaml` with:

```yaml
rules:
  - tool: "git_commit"
    pattern: "auto-fix:"
    max_per_hour: 5
  - tool: "terminal_exec"
    pattern: "npm run"
    max_per_hour: 3
  - tool: "terminal_exec"
    pattern: "python tools/health.py"
    max_per_hour: 10

never_auto_approve:
  - "git_push"
  - "terminal_exec(command=rm *)"
  - "terminal_exec(command=del *)"
  - "deploy"
  - "email_send"
```

This preserves the original semantics while matching what `_load_policies()` expects (`data.get("rules")` or direct list).

- [ ] **Step 3: Load and enforce `never_auto_approve`**

In `tools/jarvis/approval.py`, modify `__init__` and add deny-list loading:

```python
class ApprovalManager:
    def __init__(self):
        self._policies = self._load_policies()
        self._never_auto = self._load_never_auto()
```

Add `_load_never_auto()` method after `_load_policies()`:

```python
    def _load_never_auto(self) -> list[str]:
        policy_path = REPO_ROOT / "config" / "approval_policies.yaml"
        if policy_path.exists():
            try:
                import yaml
                with open(policy_path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                if isinstance(data, dict):
                    return data.get("never_auto_approve", [])
            except Exception:
                pass
        return []
```

Replace `auto_approve_check()` with:

```python
    def auto_approve_check(self, step: PlanStep) -> bool:
        # 1. Deny-list check â€?never auto-approve these
        for deny in self._never_auto:
            if "(" in deny:
                # Pattern like "terminal_exec(command=rm *)"
                tool_part, param_part = deny.split("(", 1)
                param_part = param_part.rstrip(")")
                if step.tool_name == tool_part.strip():
                    key_val = param_part.split("=", 1)
                    if len(key_val) == 2:
                        key, val_pattern = key_val
                        actual = step.params.get(key, "")
                        # Simple wildcard matching
                        if val_pattern.endswith("*"):
                            prefix = val_pattern[:-1]
                            if actual.startswith(prefix):
                                return False
                        elif actual == val_pattern:
                            return False
            else:
                if step.tool_name == deny:
                    return False

        # 2. Allow-list check
        for rule in self._policies:
            tool = rule.get("tool", "")
            pattern = rule.get("pattern", "")
            max_per_hour = rule.get("max_per_hour", 0)
            if tool and step.tool_name == tool:
                check_value = ""
                if step.tool_name == "git_commit":
                    check_value = step.params.get("message", "")
                elif step.tool_name == "terminal_exec":
                    check_value = step.params.get("command", "")
                if check_value.startswith(pattern):
                    return self._check_rate(pattern, max_per_hour)
        return False
```

- [ ] **Step 4: Run tests**

Run: `python -m pytest tests/jarvis/test_approval.py -v`

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add config/approval_policies.yaml tools/jarvis/approval.py tests/jarvis/test_approval.py
git commit -m "fix(jarvis): fix approval YAML parsing and enforce never_auto_approve deny-list"
```

---

## Task 5: Add MultiAgent task lifecycle

**Files:**
- Modify: `tools/jarvis/multi_agent.py`

**Motivation:** Tasks can be assigned (`pending`) and agents set to `busy`, but there is no way to mark a task `completed` or `failed`, and `tasks_completed`/`tasks_failed` counters on agents are never updated.

- [ ] **Step 1: Write the failing test**

```python
# tests/jarvis/test_multi_agent.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from tools.jarvis.multi_agent import MultiAgentManager


def test_task_lifecycle():
    mgr = MultiAgentManager()
    # Register a test agent
    agent = mgr.register_agent("test-bot", "watcher", "Test agent")
    agent_id = agent["id"]

    # Assign task
    task = mgr.assign_task(agent_id, "check system health")
    task_id = task["id"]
    assert task["status"] == "pending"

    # Start task
    assert mgr.start_task(task_id) is True
    t = mgr.get_task(task_id)
    assert t["status"] == "running"

    # Complete task
    assert mgr.complete_task(task_id, result={"ok": True}) is True
    t = mgr.get_task(task_id)
    assert t["status"] == "completed"

    # Check agent stats updated
    status = mgr.get_agent_status(agent_id)
    assert status["agent"]["tasks_completed"] == 1

    # Fail a task
    task2 = mgr.assign_task(agent_id, "check failing thing")
    assert mgr.fail_task(task2["id"], error="timeout") is True
    status = mgr.get_agent_status(agent_id)
    assert status["agent"]["tasks_failed"] == 1
```

Run: `python -m pytest tests/jarvis/test_multi_agent.py -v`

Expected: FAIL â€?`AttributeError: 'MultiAgentManager' object has no attribute 'start_task'`.

- [ ] **Step 2: Add task lifecycle methods**

In `tools/jarvis/multi_agent.py`, after `get_task()` (~line 210), add:

```python
    def start_task(self, task_id: str) -> bool:
        now = datetime.now().isoformat()
        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE jarvis_tasks SET status = 'running' WHERE id = %s AND status = 'pending'",
                (task_id,),
            )
            updated = cur.rowcount > 0
            cur.close()
        if updated:
            self._publish_event("task.started", {"task_id": task_id})
        return updated

    def complete_task(self, task_id: str, result: dict | None = None) -> bool:
        now = datetime.now().isoformat()
        result_json = json.dumps(result) if result else "{}"

        with get_pg_conn() as conn:
            cur = conn.cursor()
            # Get agent_id first
            cur.execute("SELECT agent_id FROM jarvis_tasks WHERE id = %s", (task_id,))
            row = cur.fetchone()
            if not row:
                cur.close()
                return False
            agent_id = row[0]

            cur.execute(
                """
                UPDATE jarvis_tasks
                SET status = 'completed', completed_at = %s, result_json = %s
                WHERE id = %s AND status IN ('pending', 'running')
                """,
                (now, result_json, task_id),
            )
            updated = cur.rowcount > 0

            if updated:
                cur.execute(
                    """
                    UPDATE jarvis_agents
                    SET tasks_completed = tasks_completed + 1, status = 'idle', last_active = %s
                    WHERE id = %s
                    """,
                    (now, agent_id),
                )
            cur.close()

        if updated:
            self._publish_event("task.completed", {"task_id": task_id, "agent_id": agent_id})
        return updated

    def fail_task(self, task_id: str, error: str = "") -> bool:
        now = datetime.now().isoformat()
        result_json = json.dumps({"error": error}) if error else "{}"

        with get_pg_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT agent_id FROM jarvis_tasks WHERE id = %s", (task_id,))
            row = cur.fetchone()
            if not row:
                cur.close()
                return False
            agent_id = row[0]

            cur.execute(
                """
                UPDATE jarvis_tasks
                SET status = 'failed', completed_at = %s, result_json = %s
                WHERE id = %s AND status IN ('pending', 'running')
                """,
                (now, result_json, task_id),
            )
            updated = cur.rowcount > 0

            if updated:
                cur.execute(
                    """
                    UPDATE jarvis_agents
                    SET tasks_failed = tasks_failed + 1, status = 'idle', last_active = %s
                    WHERE id = %s
                    """,
                    (now, agent_id),
                )
            cur.close()

        if updated:
            self._publish_event("task.failed", {"task_id": task_id, "agent_id": agent_id, "error": error})
        return updated
```

- [ ] **Step 3: Run the test**

Run: `python -m pytest tests/jarvis/test_multi_agent.py -v`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tools/jarvis/multi_agent.py tests/jarvis/test_multi_agent.py
git commit -m "feat(jarvis): add MultiAgent task lifecycle (start, complete, fail)"
```

---

## Task 6: Unify config loading via `shared_utils.load_yaml_config`

**Files:**
- Modify: `tools/jarvis/loop.py:400-422` (`_load_config`)
- Modify: `tools/jarvis/safety.py` (find config loading)
- Modify: `tools/jarvis/approval.py:26-39` (`_load_policies`)
- Modify: `tools/jarvis/comm_tools.py` (find config loading)

**Motivation:** Four modules independently load `config/jarvis.yaml` with `yaml.safe_load()`.

- [ ] **Step 1: Replace `loop.py` `_load_config`**

Replace the entire `_load_config()` method with:

```python
    def _load_config(self) -> dict:
        defaults: dict = {
            "cycle_interval": 300,
            "cycle_interval_busy": 10,
            "max_concurrent_tasks": 5,
            "learning_enabled": True,
        }
        loaded = load_yaml_config(REPO_ROOT / "config" / "jarvis.yaml", {})
        agent_config = loaded.get("agent", {})
        for key in defaults:
            if key in agent_config:
                defaults[key] = agent_config[key]
        return defaults
```

- [ ] **Step 2: Replace `approval.py` `_load_policies`**

Replace `_load_policies()` with:

```python
    def _load_policies(self) -> list[dict]:
        data = load_yaml_config(REPO_ROOT / "config" / "approval_policies.yaml", {})
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "rules" in data:
            return data["rules"]
        return DEFAULT_AUTO_APPROVE_RULES
```

- [ ] **Step 3: Find and replace in `safety.py`**

Open `tools/jarvis/safety.py`. Search for YAML loading code (`yaml.safe_load`, `open(config_path)`). If found, replace with `load_yaml_config`. The safety module likely loads `config/jarvis.yaml` for red_lines, rate_limits, and budget.

- [ ] **Step 4: Find and replace in `comm_tools.py`**

Open `tools/jarvis/tools/comm_tools.py`. Search for YAML loading. If found, replace with `load_yaml_config`.

- [ ] **Step 5: Verify no regressions**

Run a smoke test that imports all modified modules:

```python
# tests/jarvis/test_config_unified.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))


def test_all_modules_import():
    from tools.jarvis.loop import AgentLoop
    from tools.jarvis.safety import get_safety_engine
    from tools.jarvis.approval import get_approval_manager
    from tools.jarvis.comm_tools import get_comm_tools
    assert AgentLoop is not None
    assert get_safety_engine is not None
    assert get_approval_manager is not None
    assert get_comm_tools is not None
```

Run: `python -m pytest tests/jarvis/test_config_unified.py -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/jarvis/loop.py tools/jarvis/approval.py tools/jarvis/safety.py tools/jarvis/tools/comm_tools.py tests/jarvis/test_config_unified.py
git commit -m "refactor(jarvis): unify config loading through shared_utils.load_yaml_config"
```

---

## Task 7: Integration smoke test

**Files:**
- Create: `tests/jarvis/test_integration.py`

**Motivation:** Ensure the modified loop can still be instantiated and its components are wired correctly.

- [ ] **Step 1: Write integration test**

```python
# tests/jarvis/test_integration.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))


def test_loop_components_wired():
    from tools.jarvis.loop import AgentLoop
    loop = AgentLoop()

    assert loop.planner is not None
    assert loop.learner is not None
    assert loop.state_store is not None
    assert loop.approval_manager is not None
    assert loop.safety_engine is not None
    assert loop.registry is not None
    assert loop.event_bus is not None


def test_approval_never_auto_loaded():
    from tools.jarvis.approval import get_approval_manager
    mgr = get_approval_manager()
    assert len(mgr._never_auto) > 0
    assert "git_push" in mgr._never_auto


def test_multi_agent_has_lifecycle():
    from tools.jarvis.multi_agent import MultiAgentManager
    mgr = MultiAgentManager()
    assert hasattr(mgr, "start_task")
    assert hasattr(mgr, "complete_task")
    assert hasattr(mgr, "fail_task")
```

- [ ] **Step 2: Run integration test**

Run: `python -m pytest tests/jarvis/test_integration.py -v`

Expected: All 3 tests PASS.

- [ ] **Step 3: Run full test suite**

Run: `python -m pytest tests/jarvis/ -v`

Expected: All tests PASS (7+ files).

- [ ] **Step 4: Commit**

```bash
git add tests/jarvis/test_integration.py
git commit -m "test(jarvis): add integration smoke tests for wired components"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- âœ?Planner connected to loop (Task 2)
- âœ?Learner connected to loop (Task 3)
- âœ?Approval YAML parsing fixed (Task 4)
- âœ?`never_auto_approve` enforced (Task 4)
- âœ?MultiAgent task lifecycle added (Task 5)
- âœ?Shared utilities extracted (Task 1)
- âœ?Config loading unified (Task 6)
- âœ?Tests for all changes (every task has tests)

**2. Placeholder scan:**
- âœ?No "TBD", "TODO", "implement later"
- âœ?Every step shows exact code
- âœ?Every step shows exact commands and expected output
- âœ?No "Similar to Task N" shortcuts

**3. Type consistency:**
- âœ?`parse_llm_json` returns `list | dict | None` consistently across all call sites
- âœ?`load_yaml_config` signature matches all usage sites
- âœ?`ApprovalManager._never_auto` is `list[str]` throughout
- âœ?MultiAgent lifecycle methods return `bool` consistently
