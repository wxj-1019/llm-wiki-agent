# Jarvis on PostgreSQL - Full Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate all Jarvis internal storage (event bus, approvals, state, audit, tool stats, scheduled tasks) from SQLite/file to PostgreSQL, unifying the storage layer with the existing `llm_wiki` database.

**Architecture:**
- `tools/jarvis/jarvis_pg.py` upgraded from single `psycopg2.connect()` to `ThreadedConnectionPool` (same pattern as `PgSearchBackend`).
- All Jarvis modules use `get_pg_conn()` context manager for safe connection lifecycle.
- Schema co-located in `config/schema.sql` (jarvis tables appended).
- `dev_tools.py` `db_query` expanded to support PostgreSQL via a new `pg_query` tool.

**Tech Stack:** PostgreSQL 17, psycopg2, JSONB, existing `config/database.yaml`.

---

## Schema DDL

Append the following to `config/schema.sql` (after existing tables):

See `docs/superpowers/plans/jarvis-pg-schema.sql` for the full DDL.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `config/schema.sql` | Append | Jarvis PG schema |
| `tools/jarvis/jarvis_pg.py` | Rewrite | Connection pool + context manager |
| `tools/jarvis/event_bus.py` | Rewrite | PG-backed event bus |
| `tools/jarvis/approval.py` | Rewrite | PG-backed approval manager |
| `tools/jarvis/state.py` | Create | PG-backed AgentState persistence |
| `tools/jarvis/loop.py` | Modify | Audit to PG; state save/load via state.py |
| `tools/jarvis/tool_registry.py` | Modify | Stats persistence via PG |
| `tools/jarvis/config.py` | Create | Unified config loading |
| `tools/jarvis/__init__.py` | Modify | Unified exports |
| `tools/jarvis/tools/dev_tools.py` | Modify | `pg_query` tool |
| `tools/jarvis/tools/comm_tools.py` | Modify | Auto-create scheduled_tasks table |
| `tools/jarvis/self_diagnose.py` | Modify | Check PG tables instead of SQLite |
| `tools/jarvis/test_jarvis_pg.py` | Create | Full regression test suite |

---

## Task 1: Upgrade jarvis_pg.py to Connection Pool + Context Manager

**Files:**
- Rewrite: `tools/jarvis/jarvis_pg.py`
- Test: `tools/jarvis/test_jarvis_pg.py`

**Rationale:** Current `get_connection()` returns a raw connection. Caller must remember to close. A context manager eliminates leaks and matches `PgSearchBackend` patterns.

Key implementation:
- Add `_get_pool()` using `psycopg2.pool.ThreadedConnectionPool`
- Add `@contextmanager def get_pg_conn()` yielding pooled connections
- Add `close_all()` for shutdown cleanup
- Add `reset_config()` for testing

Test: `pytest tools/jarvis/test_jarvis_pg.py::test_jarvis_pg_pool -xvs`

---

## Task 2: Rewrite event_bus.py for PostgreSQL

**Files:**
- Rewrite: `tools/jarvis/event_bus.py`
- Test: `tools/jarvis/test_jarvis_pg.py`

Key changes:
- Replace `sqlite3.connect(str(DB_PATH))` with `get_pg_conn()` context manager
- Replace `?` placeholders with `%s`
- Replace `datetime('now', ?)` with `NOW() - INTERVAL '%s hours'`
- `consumed INTEGER` becomes `consumed BOOLEAN`
- `_ensure_table()` uses CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS

Test: `pytest tools/jarvis/test_jarvis_pg.py::test_event_bus_pg -xvs`

---

## Task 3: Rewrite approval.py for PostgreSQL

**Files:**
- Rewrite: `tools/jarvis/approval.py`
- Test: `tools/jarvis/test_jarvis_pg.py`

**Note:** `jarvis_approvals` table already exists in PG. Align with its schema (`step_json` is JSONB, `auto_approved` is boolean).

Key changes:
- Replace `sqlite3.connect(str(self._db_path))` with `get_pg_conn()`
- Replace `?` with `%s`
- `json.dumps(step)` passed directly to `%s` for JSONB column
- `row_factory = sqlite3.Row` replaced with tuple indexing in `_row_to_request`

Test: `pytest tools/jarvis/test_jarvis_pg.py::test_approval_manager_pg -xvs`

---

## Task 4: Create state.py (PG-backed AgentState Persistence)

**Files:**
- Create: `tools/jarvis/state.py`
- Modify: `tools/jarvis/loop.py`
- Test: `tools/jarvis/test_jarvis_pg.py`

Key implementation:
- `StateManager` uses `jarvis_state` table with `key='agent_state'` single-row pattern
- `load()` returns `AgentState` deserialized from JSONB
- `save()` serializes and UPSERTs
- Integrated into `loop.py`: `__init__` loads state, `run_cycle()` saves after learn

Test: `pytest tools/jarvis/test_jarvis_pg.py::test_state_manager_pg -xvs`

---

## Task 5: Migrate loop.py Audit from JSONL to PG

**Files:**
- Modify: `tools/jarvis/loop.py`

Key changes:
- Remove `AUDIT_PATH` constant (JSONL file)
- Replace `_write_audit()` with INSERT into `jarvis_audit` table
- Include cycle_id, step_id, tool, params_json, risk_level, approved, safety_blocked, success, error, duration_ms, tokens_input, tokens_output

Verification: `python tools/jarvis_cli.py status --json`

---

## Task 6: Migrate tool_registry.py Stats to PG

**Files:**
- Modify: `tools/jarvis/tool_registry.py`

Key changes:
- Add `_ensure_stats_table()` creating `jarvis_tool_stats`
- Modify `update_stats()` to UPSERT into PG after updating in-memory counters
- Keeps in-memory counters for fast reads, persists to PG for durability

Verification: `python -c "from tools.jarvis.tool_registry import get_registry; r=get_registry(); print('ok')"`

---

## Task 7: Update dev_tools.py with pg_query

**Files:**
- Modify: `tools/jarvis/tools/dev_tools.py`

Key changes:
- Keep `db_query` (SQLite) for backward compat
- Add `pg_query` tool using `get_pg_conn()` with SELECT-only enforcement
- Add `_register_pg_query` to `_ALL_REGISTRARS`

---

## Task 8: Ensure comm_tools.py Scheduled Tasks Table Exists

**Files:**
- Modify: `tools/jarvis/tools/comm_tools.py`

Key changes:
- Add `_ensure_scheduled_tasks_table()` creating `jarvis_scheduled_tasks` on module import
- Uses `get_pg_conn()` context manager

---

## Task 9: Update self_diagnose.py to Check PG Tables

**Files:**
- Modify: `tools/jarvis/self_diagnose.py`

Key changes:
- Replace `JARVIS_DATABASES` (SQLite files) with `JARVIS_TABLES` (PG tables)
- Replace `check_database_health()` to query PG for row counts
- Query: `SELECT COUNT(*) FROM {table}` for each jarvis_* table

---

## Task 10: Extract config.py + Populate __init__.py

**Files:**
- Create: `tools/jarvis/config.py`
- Modify: `tools/jarvis/__init__.py`

Key implementation:
- `config.py`: `JarvisConfig` class loading `config/jarvis.yaml` with deep-merge over defaults
- `__init__.py`: Unified exports of all public classes and functions

---

## Task 11: Apply Schema & Full Regression Test

- **Step 1:** Apply schema via psql: `psql -U wiki_user -d llm_wiki -f config/schema.sql`
- **Step 2:** Run all jarvis PG tests: `pytest tools/jarvis/test_jarvis_pg.py -v`
- **Step 3:** Verify CLI: `python tools/jarvis_cli.py status --json`
- **Step 4:** Verify existing tests: `pytest tools/test_search_backend.py tools/test_migration.py -v`
- **Step 5:** Verify PG tables: Query `information_schema.tables` for `jarvis_*`

---

## Execution Handoff

**Plan complete.**

**Scope:** 11 Tasks, ~2-3 hours total. Every Task produces working, testable software.

**Two execution options:**

1. **Subagent-Driven (recommended)** - Fresh subagent per Task + two-stage review
2. **Inline Execution** - Execute Tasks in this session batch-by-batch

**Which approach?**
