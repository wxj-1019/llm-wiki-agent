#!/usr/bin/env python3
"""Optional cross-platform scheduler for the automation pipeline.

Runs without cron or Windows Task Scheduler. Keeps a lightweight daemon
that executes fetch/compile/ingest/maintenance jobs at scheduled times.

Usage:
    python tools/scheduler.py
    python tools/scheduler.py --once
    python tools/scheduler.py --status

Dependencies:
    pip install schedule
"""
from __future__ import annotations

import logging
import subprocess
import sys
import time
from pathlib import Path

try:
    import schedule
except ImportError:
    print("Missing dependency: schedule")
    print("Install: pip install schedule")
    sys.exit(1)

REPO_ROOT = Path(__file__).parent.parent.resolve()
PYTHON = sys.executable

log = logging.getLogger(__name__)


class JobMetrics:
    """Track scheduler job execution metrics."""

    def __init__(self, db_path: Path | None = None):
        self._db_path = db_path or (Path(__file__).parent.parent / "state" / "scheduler_metrics.db")
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        import sqlite3
        self._conn = sqlite3.connect(str(self._db_path))
        self._conn.execute("CREATE TABLE IF NOT EXISTS job_runs (id INTEGER PRIMARY KEY, job_name TEXT, timestamp TEXT, status TEXT, duration_sec REAL, items_count INTEGER, error_message TEXT)")
        self._conn.commit()

    def record(self, job_name: str, status: str, duration: float, items: int = 0, error: str = ""):
        from datetime import datetime
        self._conn.execute("INSERT INTO job_runs (job_name, timestamp, status, duration_sec, items_count, error_message) VALUES (?, ?, ?, ?, ?, ?)", (job_name, datetime.now().isoformat(), status, round(duration, 2), items, error))
        self._conn.commit()

    def get_consecutive_failures(self, job_name: str) -> int:
        rows = self._conn.execute("SELECT status FROM job_runs WHERE job_name = ? ORDER BY id DESC LIMIT 10", (job_name,)).fetchall()
        count = 0
        for (status,) in rows:
            if status == "failure":
                count += 1
            else:
                break
        return count

    def get_consecutive_zero_results(self, job_name: str) -> int:
        rows = self._conn.execute("SELECT items_count FROM job_runs WHERE job_name = ? AND status = 'success' ORDER BY id DESC LIMIT 10", (job_name,)).fetchall()
        count = 0
        for (items,) in rows:
            if items == 0:
                count += 1
            else:
                break
        return count

    def get_average_items(self, job_name: str, runs: int = 10) -> float:
        row = self._conn.execute("SELECT AVG(items_count) FROM (SELECT items_count FROM job_runs WHERE job_name = ? AND status = 'success' ORDER BY id DESC LIMIT ?)", (job_name, runs)).fetchone()
        return round(row[0] or 0, 1)

    def get_health_panel(self) -> str:
        lines = ["Job Health Panel", "=" * 60]
        header = f"{'Job':<20} | {'Status':<10} | {'Last Run':<12} | {'Avg Items':<10} | {'Failures':<8}"
        lines.append(header)
        lines.append("-" * 60)

        jobs = self._conn.execute("SELECT DISTINCT job_name FROM job_runs").fetchall()
        for (job_name,) in jobs:
            failures = self.get_consecutive_failures(job_name)
            zero_results = self.get_consecutive_zero_results(job_name)
            avg_items = self.get_average_items(job_name)

            last_run = self._conn.execute("SELECT timestamp, status FROM job_runs WHERE job_name = ? ORDER BY id DESC LIMIT 1", (job_name,)).fetchone()
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
        self._conn.close()


class AdaptiveScheduler:
    """Decide whether a job should run based on history."""

    def __init__(self, metrics: JobMetrics):
        self._metrics = metrics

    def should_run(self, job_name: str) -> tuple[bool, str]:
        """Return (should_run, reason)."""
        failures = self._metrics.get_consecutive_failures(job_name)
        if failures >= 3:
            return False, f"consecutive failures: {failures}"

        zero_results = self._metrics.get_consecutive_zero_results(job_name)
        if zero_results >= 7:
            return False, f"no results for {zero_results} runs"

        return True, "ok"


_job_metrics: JobMetrics | None = None


def _get_job_metrics() -> JobMetrics:
    global _job_metrics
    if _job_metrics is None:
        _job_metrics = JobMetrics()
    return _job_metrics


def run_job(name: str, func, *args, **kwargs):
    metrics = _get_job_metrics()
    adaptive = AdaptiveScheduler(metrics)

    should_run, reason = adaptive.should_run(name)
    if not should_run:
        log.warning("JOB_SKIP | job=%s reason=%s", name, reason)
        return None

    log.info("JOB_START | job=%s", name)
    t0 = time.perf_counter()
    try:
        result = func(*args, **kwargs)
        dt = time.perf_counter() - t0
        log.info("JOB_OK | job=%s duration=%.2fs", name, dt)
        items = 0
        if isinstance(result, int):
            items = result
        elif isinstance(result, (list, tuple)):
            items = len(result)
        metrics.record(name, "success", dt, items)
        return result
    except Exception as exc:
        dt = time.perf_counter() - t0
        log.error("JOB_FAIL | job=%s duration=%.2fs error=%s", name, dt, exc)
        metrics.record(name, "failure", dt, 0, str(exc)[:200])


def _run(*cmds: list[str]) -> int:
    """Run subprocess commands. Returns number of successful commands."""
    success = 0
    for cmd in cmds:
        cmd_str = ' '.join(cmd)
        print(f"[scheduler] Running: {cmd_str}")
        try:
            result = subprocess.run(cmd, cwd=str(REPO_ROOT))
            if result.returncode != 0:
                print(f"[scheduler] Warning: '{cmd_str}' exited with {result.returncode}")
            else:
                success += 1
        except FileNotFoundError:
            print(f"[scheduler] Error: command not found: {cmd[0]}")
        except Exception as e:
            print(f"[scheduler] Error running '{cmd_str}': {e}")
    return success


def fetch_rss() -> int:
    return _run([PYTHON, "tools/fetchers/rss_fetcher.py", "--config", "config/rss_sources.yaml"])


def fetch_arxiv() -> int:
    return _run([PYTHON, "tools/fetchers/arxiv_fetcher.py", "--config", "config/arxiv_sources.yaml"])


def fetch_github() -> int:
    return _run([PYTHON, "tools/fetchers/github_fetcher.py", "--config", "config/github_sources.yaml"])


def fetch_web() -> int:
    return _run([PYTHON, "tools/fetchers/web_fetcher.py", "--config", "config/web_sources.yaml"])


def compile_and_ingest() -> int:
    return _run(
        [PYTHON, "tools/batch_compiler.py"],
        [PYTHON, "tools/batch_ingest.py"],
    )


def auto_ingest_web() -> int:
    return _run([PYTHON, "tools/auto_ingest.py", "--source", "web"])


def auto_ingest_rss() -> int:
    return _run([PYTHON, "tools/auto_ingest.py", "--source", "rss"])


def auto_ingest_arxiv() -> int:
    return _run([PYTHON, "tools/auto_ingest.py", "--source", "arxiv"])


def auto_ingest_all() -> int:
    return _run([PYTHON, "tools/auto_ingest.py"])


def monitor_and_refresh() -> int:
    return _run([PYTHON, "tools/refresh_monitor.py"])


# ── Composite jobs (wrapped with run_job) ──────────────────────────────────

def _web_fetch_and_ingest() -> int:
    """Fetch web pages, then auto-ingest them directly into wiki/sources/."""
    fetched = fetch_web()
    ingested = auto_ingest_web()
    return fetched + ingested


def _rss_fetch_and_ingest() -> int:
    """Fetch RSS feeds, then auto-ingest into wiki/sources/."""
    fetched = fetch_rss()
    ingested = auto_ingest_rss()
    return fetched + ingested


def _arxiv_fetch_and_ingest() -> int:
    """Fetch arXiv papers, then auto-ingest into wiki/sources/."""
    fetched = fetch_arxiv()
    ingested = auto_ingest_arxiv()
    return fetched + ingested


def _github_fetch_and_ingest() -> int:
    """Daily midnight job: fetch GitHub, then compile & ingest."""
    fetched = fetch_github()
    compiled = compile_and_ingest()
    return fetched + compiled


def _maintenance() -> int:
    """Weekly maintenance."""
    return _run(
        [PYTHON, "tools/archive_stale.py"],
        [PYTHON, "tools/health.py"],
        [PYTHON, "tools/build_graph.py"],
    )


# ── Wrapped job functions (with metrics + adaptive skip) ───────────────────

def rss_fetch_and_ingest() -> None:
    """Fetch RSS + auto-ingest with metrics tracking."""
    run_job("rss_fetch_and_ingest", _rss_fetch_and_ingest)


def arxiv_fetch_and_ingest() -> None:
    """Fetch arXiv + auto-ingest with metrics tracking."""
    run_job("arxiv_fetch_and_ingest", _arxiv_fetch_and_ingest)


def web_fetch_and_ingest() -> None:
    """Fetch web + auto-ingest with metrics tracking."""
    run_job("web_fetch_and_ingest", _web_fetch_and_ingest)


def fetch_github_and_ingest() -> None:
    """GitHub fetch + ingest with metrics tracking."""
    run_job("github_fetch_and_ingest", _github_fetch_and_ingest)


def monitor_and_refresh_job() -> None:
    """Refresh monitor with metrics tracking."""
    run_job("monitor_and_refresh", monitor_and_refresh)


def maintenance() -> None:
    """Weekly maintenance with metrics tracking."""
    run_job("maintenance", _maintenance)


# --- Schedule ---
# GitHub trending: every day at 00:00, then auto compile & ingest at 00:30
schedule.every().day.at("00:00").do(fetch_github_and_ingest)

# RSS & arXiv & Web with auto-ingest: every morning
schedule.every().day.at("08:00").do(rss_fetch_and_ingest)
schedule.every().day.at("08:30").do(arxiv_fetch_and_ingest)
schedule.every().day.at("08:45").do(web_fetch_and_ingest)

# Refresh monitor: check for upstream changes twice daily
schedule.every().day.at("14:00").do(monitor_and_refresh_job)
schedule.every().day.at("20:00").do(monitor_and_refresh_job)

# Weekly maintenance: Sunday night (includes refresh_monitor for full sweep)
schedule.every().sunday.at("22:00").do(maintenance)

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Cross-platform scheduler for the automation pipeline")
    parser.add_argument("--once", action="store_true", help="Run all pending jobs once and exit")
    parser.add_argument("--status", action="store_true", help="Show job health panel and exit")
    args = parser.parse_args()

    if args.status:
        metrics = _get_job_metrics()
        print(metrics.get_health_panel())
        metrics.close()
        sys.exit(0)

    if args.once:
        print("[scheduler] Running all pending jobs once...")
        schedule.run_all()
        metrics = _get_job_metrics()
        print(metrics.get_health_panel())
        metrics.close()
        sys.exit(0)

    print("[scheduler] Starting. Press Ctrl+C to stop.")
    print("[scheduler] Jobs:")
    for job in schedule.jobs:
        print(f"  - {job}")
    try:
        while True:
            schedule.run_pending()
            time.sleep(60)
    except KeyboardInterrupt:
        print("\n[scheduler] Stopped.")
        metrics = _get_job_metrics()
        metrics.close()
        sys.exit(0)
