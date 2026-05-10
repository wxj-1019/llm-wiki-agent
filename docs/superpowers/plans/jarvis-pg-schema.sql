-- ============================================================================
-- Jarvis Agent Tables - PostgreSQL Schema
-- Append this to config/schema.sql after existing wiki/vector tables
-- ============================================================================

-- Event bus: all agent events with consumption tracking
CREATE TABLE IF NOT EXISTS jarvis_events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    payload_json JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT '',
    consumed BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_jarvis_events_unconsumed ON jarvis_events(consumed, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_jarvis_events_name ON jarvis_events(name, timestamp DESC);

-- Scheduled tasks (used by comm_tools.schedule_task)
CREATE TABLE IF NOT EXISTS jarvis_scheduled_tasks (
    id TEXT PRIMARY KEY,
    task_type TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    executed_at TIMESTAMPTZ,
    result_json JSONB
);
CREATE INDEX IF NOT EXISTS idx_jarvis_scheduled_pending ON jarvis_scheduled_tasks(status, scheduled_at);

-- Agent state persistence (replaces in-memory + SQLite state.db)
CREATE TABLE IF NOT EXISTS jarvis_state (
    key TEXT PRIMARY KEY,
    value_json JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log (replaces state/jarvis_audit.jsonl)
CREATE TABLE IF NOT EXISTS jarvis_audit (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cycle_id TEXT,
    step_id TEXT,
    tool TEXT NOT NULL,
    params_json JSONB,
    risk_level TEXT,
    approved BOOLEAN,
    safety_blocked BOOLEAN,
    success BOOLEAN,
    error TEXT,
    duration_ms REAL,
    tokens_input INTEGER,
    tokens_output INTEGER
);
CREATE INDEX IF NOT EXISTS idx_jarvis_audit_timestamp ON jarvis_audit(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_jarvis_audit_cycle ON jarvis_audit(cycle_id);

-- Tool call statistics (replaces in-memory ToolDef counters)
CREATE TABLE IF NOT EXISTS jarvis_tool_stats (
    tool_name TEXT PRIMARY KEY,
    call_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    avg_duration_ms REAL NOT NULL DEFAULT 0,
    last_called_at TIMESTAMPTZ
);
