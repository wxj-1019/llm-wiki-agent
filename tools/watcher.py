#!/usr/bin/env python3
"""File system watcher for raw/ directory — auto-ingest on change.

Usage:
    python tools/watcher.py              # foreground mode
    python tools/watcher.py --daemon     # background (detached)
    python tools/watcher.py --once       # process existing files then exit
"""
from __future__ import annotations

import argparse
import hashlib
import logging
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

REPO = Path(__file__).parent.parent
RAW = REPO / "raw"
INGEST_SCRIPT = REPO / "tools" / "ingest.py"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("wiki-watcher")

# Debounce: batch rapid events into a single ingest
g_DEBOUNCE_SEC = 5.0
g_pending_timer: threading.Timer | None = None
g_pending_lock = threading.Lock()
g_pending_paths: set[str] = set()

# Track file hashes to avoid re-ingesting unchanged files
g_file_hashes: dict[str, str] = {}


def _file_hash(path: Path) -> str:
    """Return SHA256 of file content."""
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()[:16]
    except OSError:
        return ""


def _is_ingestable(path: Path) -> bool:
    """Check if a file should be ingested."""
    if path.name == ".gitkeep":
        return False
    if path.name.startswith("."):
        return False
    if not path.is_file():
        return False
    return True


def _run_ingest(paths: list[Path]) -> None:
    """Run ingest.py on a list of files."""
    for p in paths:
        rel = str(p.relative_to(REPO))
        logger.info("Ingesting: %s", rel)
        try:
            result = subprocess.run(
                [sys.executable, str(INGEST_SCRIPT), str(p)],
                capture_output=True,
                text=True,
                timeout=300,
            )
            if result.returncode == 0:
                logger.info("Ingest succeeded: %s", rel)
            else:
                logger.error("Ingest failed: %s\nstderr: %s", rel, result.stderr[:500])
        except subprocess.TimeoutExpired:
            logger.error("Ingest timed out: %s", rel)
        except Exception as e:
            logger.error("Ingest error: %s — %s", rel, e)


def _flush_pending() -> None:
    """Flush the pending path set to ingest."""
    global g_pending_timer, g_pending_paths
    with g_pending_lock:
        paths = sorted(g_pending_paths)
        g_pending_paths.clear()
        g_pending_timer = None

    if not paths:
        return

    # Filter to only changed files
    to_ingest: list[Path] = []
    for rel in paths:
        p = REPO / rel
        if not p.exists():
            continue
        if not _is_ingestable(p):
            continue
        h = _file_hash(p)
        key = str(p.resolve())
        if g_file_hashes.get(key) != h:
            g_file_hashes[key] = h
            to_ingest.append(p)

    if to_ingest:
        logger.info("Flushing %d file(s) for ingest", len(to_ingest))
        _run_ingest(to_ingest)
    else:
        logger.debug("No changed files to ingest")


def _schedule(rel_path: str) -> None:
    """Schedule a file for debounced ingest."""
    global g_pending_timer
    with g_pending_lock:
        g_pending_paths.add(rel_path)
        if g_pending_timer is not None:
            g_pending_timer.cancel()
        g_pending_timer = threading.Timer(g_DEBOUNCE_SEC, _flush_pending)
        g_pending_timer.start()


def _on_created(path: Path) -> None:
    if not _is_ingestable(path):
        return
    logger.info("File created: %s", path.relative_to(REPO))
    _schedule(str(path.relative_to(REPO)))


def _on_modified(path: Path) -> None:
    if not _is_ingestable(path):
        return
    logger.info("File modified: %s", path.relative_to(REPO))
    _schedule(str(path.relative_to(REPO)))


def _on_deleted(path: Path) -> None:
    logger.info("File deleted: %s", path.relative_to(REPO))
    # TODO: mark corresponding wiki source as archived
    # (Iteration 2+)


def _scan_existing() -> None:
    """Scan raw/ for existing files and ingest any new ones."""
    if not RAW.exists():
        return
    for p in RAW.rglob("*"):
        if not _is_ingestable(p):
            continue
        h = _file_hash(p)
        key = str(p.resolve())
        if g_file_hashes.get(key) != h:
            g_file_hashes[key] = h
            logger.info("Found existing file: %s", p.relative_to(REPO))
            _schedule(str(p.relative_to(REPO)))
    # Flush immediately for --once mode
    _flush_pending()


# ── Watchdog-based observer ──

def _watch_with_watchdog() -> None:
    try:
        from watchdog.observers import Observer
        from watchdog.events import FileSystemEventHandler
    except ImportError:
        logger.error("watchdog not installed. Run: pip install watchdog")
        sys.exit(1)

    class Handler(FileSystemEventHandler):
        def on_created(self, event):
            if not event.is_directory:
                _on_created(Path(event.src_path))

        def on_modified(self, event):
            if not event.is_directory:
                _on_modified(Path(event.src_path))

        def on_deleted(self, event):
            if not event.is_directory:
                _on_deleted(Path(event.src_path))

        def on_moved(self, event):
            if not event.is_directory:
                _on_deleted(Path(event.src_path))
                _on_created(Path(event.dest_path))

    if not RAW.exists():
        RAW.mkdir(parents=True, exist_ok=True)

    observer = Observer()
    observer.schedule(Handler(), str(RAW), recursive=True)
    observer.start()
    logger.info("Watching %s for changes (debounce=%.1fs)", RAW, g_DEBOUNCE_SEC)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Stopping watcher...")
        observer.stop()
    observer.join()


# ── Fallback: polling-based watcher ──

def _watch_with_polling(interval: float = 5.0) -> None:
    """Simple polling fallback when watchdog is unavailable."""
    logger.info("Using polling watcher (interval=%.1fs)", interval)
    known: dict[str, float] = {}

    def scan():
        if not RAW.exists():
            return
        current: dict[str, float] = {}
        for p in RAW.rglob("*"):
            if not _is_ingestable(p):
                continue
            key = str(p.resolve())
            try:
                mtime = p.stat().st_mtime
            except OSError:
                continue
            current[key] = mtime
            if key not in known:
                _on_created(p)
            elif known[key] != mtime:
                _on_modified(p)
        # Detect deletions
        for key in list(known.keys()):
            if key not in current:
                _on_deleted(Path(key))
        known.clear()
        known.update(current)

    scan()  # initial scan
    try:
        while True:
            time.sleep(interval)
            scan()
    except KeyboardInterrupt:
        logger.info("Stopping watcher...")


# ── CLI ──

def main():
    global g_DEBOUNCE_SEC
    parser = argparse.ArgumentParser(description="Watch raw/ and auto-ingest changes")
    parser.add_argument("--once", action="store_true", help="Process existing files then exit")
    parser.add_argument("--daemon", action="store_true", help="Run as background daemon")
    parser.add_argument("--poll", action="store_true", help="Use polling instead of watchdog")
    parser.add_argument("--debounce", type=float, default=g_DEBOUNCE_SEC, help="Debounce seconds")
    args = parser.parse_args()

    g_DEBOUNCE_SEC = args.debounce

    if args.once:
        _scan_existing()
        return

    if args.daemon:
        # Detach from terminal
        if os.name != "nt":
            import daemon
            with daemon.DaemonContext():
                _watch_with_polling() if args.poll else _watch_with_watchdog()
        else:
            logger.warning("--daemon not supported on Windows, running in foreground")

    if args.poll:
        _watch_with_polling()
    else:
        try:
            _watch_with_watchdog()
        except ImportError:
            logger.warning("watchdog not available, falling back to polling")
            _watch_with_polling()


if __name__ == "__main__":
    main()
