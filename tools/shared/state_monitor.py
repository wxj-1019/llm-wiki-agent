#!/usr/bin/env python3
"""Poll state/ files for changes and emit events via EventBus.

Synchronous scripts (scheduler.py, web_fetcher.py) cannot directly call
event_bus.emit(). This monitor bridges the gap by polling state directory
files every 10s, diffing snapshots, and emitting events for detected
degradations and recoveries.
"""
from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any

from tools.shared.event_bus import event_bus

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
STATE_DIR = REPO_ROOT / "state"
RAW_INBOX = REPO_ROOT / "raw-inbox"


def _snapshot_state_dir() -> dict[str, Any]:
    """Build a snapshot of all monitorable state files."""
    snap: dict[str, Any] = {}

    # Pipeline state (raw-inbox/state.json)
    state_json = RAW_INBOX / "state.json"
    if state_json.exists():
        try:
            data = json.loads(state_json.read_text(encoding="utf-8"))
            snap["pipeline"] = {
                "processed_urls": len(data.get("processed_urls", {})),
                "last_runs": data.get("last_runs", {}),
                "auto_ingested": len(data.get("auto_ingested", [])),
            }
        except (json.JSONDecodeError, OSError):
            snap["pipeline"] = {"processed_urls": 0, "last_runs": {}, "auto_ingested": 0}

    # Scheduler metrics DB (state/scheduler_metrics.db)
    try:
        from tools.shared.state_manager import SchedulerMetrics
        metrics = SchedulerMetrics()
        jobs_snap: dict[str, dict[str, int]] = {}
        try:
            if metrics._pg_mode:
                import psycopg2
                cfg = metrics._pg_config
                conn = psycopg2.connect(
                    host=cfg["host"], port=cfg["port"],
                    dbname=cfg["database"], user=cfg["user"],
                    password=cfg["password"], sslmode=cfg.get("sslmode", "prefer"),
                )
                try:
                    cur = conn.cursor()
                    cur.execute("SELECT DISTINCT job_name FROM scheduler_jobs")
                    for (job_name,) in cur.fetchall():
                        jobs_snap[job_name] = {
                            "consecutive_failures": metrics.get_consecutive_failures(job_name),
                            "consecutive_zero_results": metrics.get_consecutive_zero_results(job_name),
                        }
                    cur.close()
                finally:
                    conn.close()
            else:
                rows = metrics._conn.execute("SELECT DISTINCT job_name FROM job_runs").fetchall()
                for (job_name,) in rows:
                    jobs_snap[job_name] = {
                        "consecutive_failures": metrics.get_consecutive_failures(job_name),
                        "consecutive_zero_results": metrics.get_consecutive_zero_results(job_name),
                    }
        finally:
            metrics.close()
        snap["scheduler"] = jobs_snap
    except Exception:
        snap["scheduler"] = {}

    return snap


def _diff_snapshots(prev: dict[str, Any], curr: dict[str, Any]) -> list[dict]:
    """Compare two snapshots and return list of events to emit."""
    events: list[dict] = []

    # Scheduler job health
    prev_jobs: dict = prev.get("scheduler", {})
    curr_jobs: dict = curr.get("scheduler", {})
    for job_name, curr_stats in curr_jobs.items():
        prev_stats: dict = prev_jobs.get(job_name, {})
        prev_fail = prev_stats.get("consecutive_failures", 0)
        curr_fail = curr_stats.get("consecutive_failures", 0)

        # Degradation threshold crossings
        if prev_fail < 3 and curr_fail >= 3:
            events.append({
                "type": "pipeline.degraded",
                "data": {"job": job_name, "failures": curr_fail},
                "severity": "warning",
            })
        if prev_fail < 5 and curr_fail >= 5:
            events.append({
                "type": "pipeline.failed",
                "data": {"job": job_name, "failures": curr_fail},
                "severity": "critical",
            })
        # Recovery
        if prev_fail >= 3 and curr_fail == 0:
            events.append({
                "type": "system.recovered",
                "data": {"resource": f"Job {job_name}"},
                "severity": "success",
            })

    return events


async def monitor_state_changes(interval: float = 10.0) -> None:
    """Poll state/ every `interval` seconds, emit events on changes.

    Intended to be launched as a background asyncio task at server startup.
    """
    prev_state: dict[str, Any] = {}
    while True:
        try:
            new_state = _snapshot_state_dir()
            if prev_state:
                events = _diff_snapshots(prev_state, new_state)
                for evt in events:
                    event_bus.emit(evt["type"], evt["data"], evt["severity"])
            prev_state = new_state
        except Exception:
            pass  # Never let a monitor error crash the server
        await asyncio.sleep(interval)
