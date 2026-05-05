#!/usr/bin/env python3
"""Optional cross-platform scheduler for the automation pipeline.

Runs without cron or Windows Task Scheduler. Keeps a lightweight daemon
that executes fetch/compile/ingest/maintenance jobs at scheduled times.

Usage:
    python tools/scheduler.py

Dependencies:
    pip install schedule
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

try:
    import schedule
except ImportError:
    print("Missing dependency: schedule")
    print("Install: pip install schedule")
    sys.exit(1)

REPO_ROOT = Path(__file__).parent.parent.resolve()
PYTHON = sys.executable


def _run(*cmds: list[str]) -> None:
    for cmd in cmds:
        print(f"[scheduler] Running: {' '.join(cmd)}")
        try:
            result = subprocess.run(cmd, cwd=str(REPO_ROOT))
            if result.returncode != 0:
                print(f"[scheduler] Warning: '{' '.join(cmd)}' exited with {result.returncode}")
        except FileNotFoundError:
            print(f"[scheduler] Error: command not found: {cmd[0]}")
        except Exception as e:
            print(f"[scheduler] Error running '{' '.join(cmd)}': {e}")


def fetch_rss() -> None:
    _run([PYTHON, "tools/fetchers/rss_fetcher.py", "--config", "config/rss_sources.yaml"])


def fetch_arxiv() -> None:
    _run([PYTHON, "tools/fetchers/arxiv_fetcher.py", "--config", "config/arxiv_sources.yaml"])


def fetch_github() -> None:
    _run([PYTHON, "tools/fetchers/github_fetcher.py", "--config", "config/github_sources.yaml"])


def compile_and_ingest() -> None:
    _run(
        [PYTHON, "tools/batch_compiler.py"],
        [PYTHON, "tools/batch_ingest.py"],
    )


def fetch_github_and_ingest() -> None:
    """Daily midnight job: fetch GitHub trending + specific repos, then compile & ingest."""
    fetch_github()
    compile_and_ingest()


def maintenance() -> None:
    _run(
        [PYTHON, "tools/archive_stale.py"],
        [PYTHON, "tools/health.py"],
        [PYTHON, "tools/build_graph.py"],
    )


# --- Schedule ---
# GitHub trending: every day at 00:00, then auto compile & ingest at 00:30
schedule.every().day.at("00:00").do(fetch_github_and_ingest)

# RSS & arXiv: every morning
schedule.every().day.at("08:00").do(fetch_rss)
schedule.every().day.at("08:30").do(fetch_arxiv)

# Weekly maintenance: Sunday night
schedule.every().sunday.at("22:00").do(maintenance)

if __name__ == "__main__":
    print("[scheduler] Starting. Press Ctrl+C to stop.")
    print("[scheduler] Jobs:")
    for job in schedule.jobs:
        print(f"  - {job}")
    try:
        import time
        while True:
            schedule.run_pending()
            time.sleep(60)
    except KeyboardInterrupt:
        print("\n[scheduler] Stopped.")
        sys.exit(0)
