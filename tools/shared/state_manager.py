#!/usr/bin/env python3
"""Unified state management — PostgreSQL or JSON fallback.

Replaces scattered JSON files and SQLite DBs with a single abstraction
that reads config/database.yaml to decide where to persist state.

Usage:
    from tools.shared.state_manager import get_pipeline_state, save_pipeline_state
    state = get_pipeline_state()
    state["processed_urls"][url] = True
    save_pipeline_state(state)
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
STATE_DIR = REPO_ROOT / "state"
RAW_INBOX = REPO_ROOT / "raw-inbox"

# ── Config helpers ──

_pg_config_cache: dict[str, Any] | None = None
_pg_config_lock = threading.Lock()


def _load_pg_config() -> dict[str, Any] | None:
    """Load PG config if backend is postgresql."""
    global _pg_config_cache
    with _pg_config_lock:
        if _pg_config_cache is not None:
            return _pg_config_cache
        yaml_path = REPO_ROOT / "config" / "database.yaml"
        if not yaml_path.exists():
            _pg_config_cache = {}
            return None
        try:
            import yaml
            cfg = yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
        except Exception:
            _pg_config_cache = {}
            return None
        backend = cfg.get("database", {}).get("backend", "sqlite")
        if backend != "postgresql":
            _pg_config_cache = {}
            return None
        pg = cfg.get("database", {}).get("postgresql", {})
        # Resolve env var placeholders like ${PG_PASSWORD}
        resolved = {}
        for k, v in pg.items():
            if isinstance(v, str) and v.startswith("${") and v.endswith("}"):
                resolved[k] = os.getenv(v[2:-1], "")
            else:
                resolved[k] = v
        _pg_config_cache = resolved
        return resolved


def _pg_connection() -> Any:
    import psycopg2
    cfg = _load_pg_config()
    if not cfg:
        raise RuntimeError("PG config not available")
    return psycopg2.connect(
        host=cfg["host"], port=cfg["port"],
        dbname=cfg["database"], user=cfg["user"],
        password=cfg["password"], sslmode=cfg.get("sslmode", "prefer"),
    )


# ── Pipeline State (replaces raw-inbox/state.json) ──

_pipeline_lock = threading.Lock()
_pipeline_json_cache: dict[str, Any] | None = None


def get_pipeline_state() -> dict[str, Any]:
    """Load pipeline state from PG (JSON fallback removed)."""
    cfg = _load_pg_config()
    if cfg:
        return _get_pipeline_state_pg()
    return _get_pipeline_state_json()


def save_pipeline_state(state: dict[str, Any]) -> None:
    """Save pipeline state to PG (JSON fallback removed)."""
    cfg = _load_pg_config()
    if cfg:
        _save_pipeline_state_pg(state)
        return
    _save_pipeline_state_json(state)


def _get_pipeline_state_pg() -> dict[str, Any]:
    conn = _pg_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT url, etag, last_modified, content_hash, status, fetched_at, ingested_at, source_type, error_message, retry_count, next_retry_at, extra_meta FROM pipeline_state"
        )
        rows = cur.fetchall()
        cur.close()

        processed_urls = {}
        url_meta = {}
        content_hashes = {}
        last_runs = {}

        for row in rows:
            (url, etag, last_modified, content_hash, status, fetched_at,
             ingested_at, source_type, error_msg, retry_count, next_retry_at,
             extra_meta) = row
            if status == "ingested":
                processed_urls[url] = True
            url_meta[url] = {
                "etag": etag or "",
                "last_modified": last_modified or "",
                "content_fp": content_hash or "",
            }
            if content_hash:
                content_hashes[url] = content_hash
            if fetched_at:
                last_runs[url] = fetched_at.isoformat() if hasattr(fetched_at, "isoformat") else str(fetched_at)

        return {
            "processed_urls": processed_urls,
            "url_meta": url_meta,
            "content_hashes": content_hashes,
            "last_runs": last_runs,
            "auto_ingested": state.get("auto_ingested", []) if 'state' in dir() else [],
        }
    finally:
        conn.close()


def _save_pipeline_state_pg(state: dict[str, Any]) -> None:
    conn = _pg_connection()
    try:
        cur = conn.cursor()
        url_meta = state.get("url_meta", {})
        processed = state.get("processed_urls", {})
        for url, meta in url_meta.items():
            status = "ingested" if url in processed else "fetched"
            cur.execute(
                """
                INSERT INTO pipeline_state (url, etag, last_modified, content_hash, status, source_type)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (url) DO UPDATE SET
                    etag = EXCLUDED.etag,
                    last_modified = EXCLUDED.last_modified,
                    content_hash = EXCLUDED.content_hash,
                    status = EXCLUDED.status,
                    source_type = EXCLUDED.source_type
                """,
                (
                    url,
                    meta.get("etag", ""),
                    meta.get("last_modified", ""),
                    meta.get("content_fp", ""),
                    status,
                    "web",
                ),
            )
        conn.commit()
        cur.close()
    finally:
        conn.close()


def _get_pipeline_state_json() -> dict[str, Any]:
    global _pipeline_json_cache
    with _pipeline_lock:
        if _pipeline_json_cache is not None:
            return _pipeline_json_cache.copy()
        path = RAW_INBOX / "state.json"
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                data = {}
        else:
            data = {}
        defaults = {
            "processed_urls": {},
            "last_runs": {},
            "url_meta": {},
            "content_hashes": {},
            "auto_ingested": [],
        }
        for k, v in defaults.items():
            data.setdefault(k, v)
        _pipeline_json_cache = data
        return data.copy()


def _save_pipeline_state_json(state: dict[str, Any]) -> None:
    with _pipeline_lock:
        path = RAW_INBOX / "state.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(path)
        global _pipeline_json_cache
        _pipeline_json_cache = state.copy()


def clear_pipeline_state_cache() -> None:
    """Clear in-memory pipeline state cache."""
    global _pipeline_json_cache
    with _pipeline_lock:
        _pipeline_json_cache = None


# ── Scheduler Metrics (replaces state/scheduler_metrics.db) ──

class SchedulerMetrics:
    """Unified scheduler metrics storage (PG or SQLite)."""

    def __init__(self, db_path: Path | None = None):
        self._pg_config = _load_pg_config()
        if self._pg_config:
            self._pg_mode = True
            return
        self._pg_mode = False
        self._db_path = db_path or (STATE_DIR / "scheduler_metrics.db")
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self._db_path))
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS job_runs ("
            "id INTEGER PRIMARY KEY, job_name TEXT, timestamp TEXT, "
            "status TEXT, duration_sec REAL, items_count INTEGER, error_message TEXT)"
        )
        self._conn.commit()

    def record(self, job_name: str, status: str, duration: float, items: int = 0, error: str = "") -> None:
        ts = datetime.now(timezone.utc).isoformat()
        if self._pg_mode:
            conn = _pg_connection()
            try:
                cur = conn.cursor()
                cur.execute(
                    "INSERT INTO scheduler_jobs (job_name, started_at, status, duration_ms, items_count, error_msg) "
                    "VALUES (%s, %s, %s, %s, %s, %s)",
                    (job_name, ts, status, round(duration * 1000, 2), items, error),
                )
                conn.commit()
                cur.close()
            finally:
                conn.close()
        else:
            self._conn.execute(
                "INSERT INTO job_runs (job_name, timestamp, status, duration_sec, items_count, error_message) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (job_name, ts, status, round(duration, 2), items, error),
            )
            self._conn.commit()

    def get_consecutive_failures(self, job_name: str) -> int:
        if self._pg_mode:
            conn = _pg_connection()
            try:
                cur = conn.cursor()
                cur.execute(
                    "SELECT status FROM scheduler_jobs WHERE job_name = %s ORDER BY started_at DESC LIMIT 10",
                    (job_name,),
                )
                rows = cur.fetchall()
                cur.close()
            finally:
                conn.close()
        else:
            rows = self._conn.execute(
                "SELECT status FROM job_runs WHERE job_name = ? ORDER BY id DESC LIMIT 10",
                (job_name,),
            ).fetchall()
        count = 0
        for (status,) in rows:
            if status == "failure":
                count += 1
            else:
                break
        return count

    def get_consecutive_zero_results(self, job_name: str) -> int:
        if self._pg_mode:
            conn = _pg_connection()
            try:
                cur = conn.cursor()
                cur.execute(
                    "SELECT items_count FROM scheduler_jobs WHERE job_name = %s AND status = 'success' ORDER BY started_at DESC LIMIT 10",
                    (job_name,),
                )
                rows = cur.fetchall()
                cur.close()
            finally:
                conn.close()
        else:
            rows = self._conn.execute(
                "SELECT items_count FROM job_runs WHERE job_name = ? AND status = 'success' ORDER BY id DESC LIMIT 10",
                (job_name,),
            ).fetchall()
        count = 0
        for (items,) in rows:
            if items == 0:
                count += 1
            else:
                break
        return count

    def get_average_items(self, job_name: str, runs: int = 10) -> float:
        if self._pg_mode:
            conn = _pg_connection()
            try:
                cur = conn.cursor()
                cur.execute(
                    "SELECT AVG(items_count) FROM ("
                    "SELECT items_count FROM scheduler_jobs WHERE job_name = %s AND status = 'success' ORDER BY started_at DESC LIMIT %s"
                    ") AS t",
                    (job_name, runs),
                )
                row = cur.fetchone()
                cur.close()
            finally:
                conn.close()
        else:
            row = self._conn.execute(
                "SELECT AVG(items_count) FROM (SELECT items_count FROM job_runs WHERE job_name = ? AND status = 'success' ORDER BY id DESC LIMIT ?)",
                (job_name, runs),
            ).fetchone()
        return round(row[0] or 0, 1)

    def get_health_panel(self) -> str:
        lines = ["Job Health Panel", "=" * 60]
        header = f"{'Job':<20} | {'Status':<10} | {'Last Run':<12} | {'Avg Items':<10} | {'Failures':<8}"
        lines.append(header)
        lines.append("-" * 60)
        if self._pg_mode:
            conn = _pg_connection()
            try:
                cur = conn.cursor()
                cur.execute("SELECT DISTINCT job_name FROM scheduler_jobs")
                jobs = cur.fetchall()
                cur.close()
            finally:
                conn.close()
        else:
            jobs = self._conn.execute("SELECT DISTINCT job_name FROM job_runs").fetchall()
        for (job_name,) in jobs:
            failures = self.get_consecutive_failures(job_name)
            zero_results = self.get_consecutive_zero_results(job_name)
            avg_items = self.get_average_items(job_name)
            if self._pg_mode:
                conn = _pg_connection()
                try:
                    cur = conn.cursor()
                    cur.execute(
                        "SELECT started_at, status FROM scheduler_jobs WHERE job_name = %s ORDER BY started_at DESC LIMIT 1",
                        (job_name,),
                    )
                    last_run = cur.fetchone()
                    cur.close()
                finally:
                    conn.close()
            else:
                last_run = self._conn.execute(
                    "SELECT timestamp, status FROM job_runs WHERE job_name = ? ORDER BY id DESC LIMIT 1",
                    (job_name,),
                ).fetchone()
            last_ts = last_run[0][:10] if last_run else "never"
            if failures >= 3:
                status_str = "!! FAIL"
            elif zero_results >= 7:
                status_str = "?? SKIP"
            else:
                status_str = "OK"
            fail_info = f"{failures}" if failures > 0 else ("zero×" + str(zero_results) if zero_results >= 3 else "0")
            lines.append(f"{job_name:<20} | {status_str:<10} | {last_ts:<12} | {avg_items:<10} | {fail_info:<8}")
        return "\n".join(lines)

    def close(self):
        if not self._pg_mode:
            self._conn.close()


# ── Refresh Monitor State (replaces state/refresh_monitor.json) ──

class RefreshMonitorState:
    """Unified refresh monitor storage (PG or JSON).

    Maps the refresh_monitor table to the JSON cache structure used by
    refresh_monitor.py:
        {
            "last_checks": {url: iso_timestamp},
            "url_stats": {url: {checks, total_changes, last_change, ...}},
            "change_history": [{wiki_page, source_url, checked_at, reason}],
        }

    PG stores url_stats per-row; change_history stays in JSON file.
    """

    def __init__(self, json_path: Path | None = None):
        self._pg_config = _load_pg_config()
        self._json_path = json_path or (STATE_DIR / "refresh_monitor.json")

    def _load_json(self) -> dict[str, Any]:
        if self._json_path.exists():
            try:
                return json.loads(self._json_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        return {"last_checks": {}, "url_stats": {}, "change_history": []}

    def _save_json(self, data: dict[str, Any]) -> None:
        self._json_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._json_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self._json_path)

    def load(self) -> dict[str, Any]:
        """Load full monitor cache (JSON + optional PG overlay for url_stats)."""
        data = self._load_json()
        if self._pg_config:
            try:
                pg_stats = self._load_pg_url_stats()
                # Merge PG url_stats over JSON (PG is authoritative)
                data["url_stats"].update(pg_stats)
            except Exception:
                pass
        return data

    def save(self, data: dict[str, Any]) -> None:
        """Save monitor cache (url_stats to PG if available, all to JSON)."""
        self._save_json(data)
        if self._pg_config:
            try:
                self._save_pg_url_stats(data.get("url_stats", {}))
            except Exception:
                pass

    def _load_pg_url_stats(self) -> dict[str, Any]:
        conn = _pg_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT source_url, last_checked_at, total_changes, last_change_at, "
                "checks_count, avg_days_between, change_timestamps FROM refresh_monitor"
            )
            rows = cur.fetchall()
            cur.close()
            stats = {}
            for row in rows:
                (url, checked, changes, last_change, checks, avg_days, timestamps) = row
                stats[url] = {
                    "checks": checks or 0,
                    "total_changes": changes or 0,
                    "last_change": last_change.isoformat() if last_change else None,
                    "change_timestamps": json.loads(timestamps) if timestamps else [],
                    "avg_days_between_changes": avg_days,
                    "first_seen": None,  # Not tracked in PG schema
                }
            return stats
        finally:
            conn.close()

    def _save_pg_url_stats(self, url_stats: dict[str, Any]) -> None:
        conn = _pg_connection()
        try:
            cur = conn.cursor()
            for url, meta in url_stats.items():
                timestamps = json.dumps(meta.get("change_timestamps", []))
                cur.execute(
                    """
                    INSERT INTO refresh_monitor (
                        source_url, last_checked_at, total_changes, last_change_at,
                        checks_count, avg_days_between, change_timestamps
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (source_url) DO UPDATE SET
                        last_checked_at = EXCLUDED.last_checked_at,
                        total_changes = EXCLUDED.total_changes,
                        last_change_at = EXCLUDED.last_change_at,
                        checks_count = EXCLUDED.checks_count,
                        avg_days_between = EXCLUDED.avg_days_between,
                        change_timestamps = EXCLUDED.change_timestamps
                    """,
                    (
                        url,
                        meta.get("last_check"),
                        meta.get("total_changes", 0),
                        meta.get("last_change"),
                        meta.get("checks", 0),
                        meta.get("avg_days_between_changes"),
                        timestamps,
                    ),
                )
            conn.commit()
            cur.close()
        finally:
            conn.close()


# ── Search Analytics (replaces state/search_analytics.db) ──

class SearchAnalytics:
    """Unified search query analytics (PG or SQLite)."""

    def __init__(self, db_path: Path | None = None):
        self._pg_config = _load_pg_config()
        if self._pg_config:
            self._pg_mode = True
            return
        self._pg_mode = False
        self._db_path = db_path or (STATE_DIR / "search_analytics.db")
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        import sqlite3
        self._conn = sqlite3.connect(str(self._db_path))
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS search_queries ("
            "id INTEGER PRIMARY KEY, timestamp TEXT, query TEXT, "
            "result_count INTEGER, source TEXT, latency_ms REAL, did_you_mean TEXT)"
        )
        self._conn.commit()

    def record(self, query: str, result_count: int, source: str = "api", latency_ms: float = 0, did_you_mean: str | None = None):
        ts = datetime.now(timezone.utc).isoformat()
        if self._pg_mode:
            conn = _pg_connection()
            try:
                cur = conn.cursor()
                cur.execute(
                    "INSERT INTO search_queries (timestamp, query, result_count, source, latency_ms, did_you_mean) "
                    "VALUES (%s, %s, %s, %s, %s, %s)",
                    (ts, query, result_count, source, latency_ms, did_you_mean or ""),
                )
                conn.commit()
                cur.close()
            finally:
                conn.close()
        else:
            self._conn.execute(
                "INSERT INTO search_queries (timestamp, query, result_count, source, latency_ms, did_you_mean) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (ts, query, result_count, source, latency_ms, did_you_mean or ""),
            )
            self._conn.commit()

    def get_zero_result_queries(self, days: int = 7) -> list[dict]:
        from datetime import datetime, timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        if self._pg_mode:
            conn = _pg_connection()
            try:
                cur = conn.cursor()
                cur.execute(
                    "SELECT query, COUNT(*) as cnt FROM search_queries WHERE result_count = 0 AND timestamp > %s GROUP BY query ORDER BY cnt DESC LIMIT 20",
                    (cutoff,),
                )
                rows = cur.fetchall()
                cur.close()
            finally:
                conn.close()
        else:
            rows = self._conn.execute(
                "SELECT query, COUNT(*) as cnt FROM search_queries WHERE result_count = 0 AND timestamp > ? GROUP BY query ORDER BY cnt DESC LIMIT 20",
                (cutoff,),
            ).fetchall()
        return [{"query": r[0], "count": r[1]} for r in rows]

    def get_stats(self, days: int = 7) -> dict:
        from datetime import datetime, timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        if self._pg_mode:
            conn = _pg_connection()
            try:
                cur = conn.cursor()
                cur.execute("SELECT COUNT(*) FROM search_queries WHERE timestamp > %s", (cutoff,))
                total = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM search_queries WHERE result_count = 0 AND timestamp > %s", (cutoff,))
                zero = cur.fetchone()[0]
                cur.close()
            finally:
                conn.close()
        else:
            total = self._conn.execute("SELECT COUNT(*) FROM search_queries WHERE timestamp > ?", (cutoff,)).fetchone()[0]
            zero = self._conn.execute("SELECT COUNT(*) FROM search_queries WHERE result_count = 0 AND timestamp > ?", (cutoff,)).fetchone()[0]
        return {
            "total_queries": total,
            "zero_result_count": zero,
            "zero_result_rate": round(zero / total * 100, 1) if total > 0 else 0,
        }

    def close(self):
        if not self._pg_mode:
            self._conn.close()
