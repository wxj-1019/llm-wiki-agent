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
GRAPH_BUILD_SCRIPT = REPO / "tools" / "build_graph.py"
GRAPH_DIRS = [REPO / "tools", REPO / "wiki-viewer" / "src"]
GRAPH_EXTS = {".py", ".ts", ".tsx", ".js", ".jsx", ".md"}

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

# Graph rebuild debounce (separate, longer)
g_GRAPH_DEBOUNCE_SEC = 10.0
g_graph_timer: threading.Timer | None = None
g_graph_lock = threading.Lock()
g_graph_pending: set[str] = set()

# Track file hashes to avoid re-ingesting unchanged files
g_file_hashes: dict[str, str] = {}
g_graph_hashes: dict[str, str] = {}


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


def _is_graphable(path: Path) -> bool:
    """Check if a file change should trigger graph rebuild."""
    if not path.is_file():
        return False
    if path.name.startswith("."):
        return False
    if path.suffix.lower() not in GRAPH_EXTS:
        return False
    # Exclude cache / build artifacts
    excluded = {"__pycache__", "node_modules", ".venv", "dist", "build", "graph"}
    if any(part in excluded for part in path.parts):
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


def _run_graph_build(paths: list[Path]) -> None:
    """Run build_graph.py --incremental after code/wiki changes."""
    logger.info("Graph rebuild triggered by %d file(s)", len(paths))
    for p in paths:
        logger.info("  -> %s", p.relative_to(REPO))
    try:
        result = subprocess.run(
            [sys.executable, str(GRAPH_BUILD_SCRIPT), "--incremental", "--code", "--no-infer"],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode == 0:
            logger.info("Graph rebuild succeeded")
        else:
            logger.error("Graph rebuild failed:\n%s", result.stderr[:500])
    except subprocess.TimeoutExpired:
        logger.error("Graph rebuild timed out")
    except Exception as e:
        logger.error("Graph rebuild error: %s", e)


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


def _flush_graph_pending() -> None:
    """Flush pending graph rebuild paths."""
    global g_graph_timer, g_graph_pending
    with g_graph_lock:
        paths = sorted(g_graph_pending)
        g_graph_pending.clear()
        g_graph_timer = None

    if not paths:
        return

    to_build: list[Path] = []
    for rel in paths:
        p = REPO / rel
        if not p.exists():
            continue
        if not _is_graphable(p):
            continue
        h = _file_hash(p)
        key = str(p.resolve())
        if g_graph_hashes.get(key) != h:
            g_graph_hashes[key] = h
            to_build.append(p)

    if to_build:
        _run_graph_build(to_build)
    else:
        logger.debug("No changed graph files to rebuild")


def _schedule_graph(rel_path: str) -> None:
    """Schedule a file for debounced graph rebuild."""
    global g_graph_timer
    with g_graph_lock:
        g_graph_pending.add(rel_path)
        if g_graph_timer is not None:
            g_graph_timer.cancel()
        g_graph_timer = threading.Timer(g_GRAPH_DEBOUNCE_SEC, _flush_graph_pending)
        g_graph_timer.start()


def _on_created(path: Path) -> None:
    rel = str(path.relative_to(REPO))
    if _is_ingestable(path):
        logger.info("File created: %s", rel)
        _schedule(rel)
    if _is_graphable(path):
        logger.info("Graph file created: %s", rel)
        _schedule_graph(rel)


def _on_modified(path: Path) -> None:
    rel = str(path.relative_to(REPO))
    if _is_ingestable(path):
        logger.info("File modified: %s", rel)
        _schedule(rel)
    if _is_graphable(path):
        logger.info("Graph file modified: %s", rel)
        _schedule_graph(rel)


def _on_deleted(path: Path) -> None:
    logger.info("File deleted: %s", path.relative_to(REPO))
    # TODO: mark corresponding wiki source as archived
    # (Iteration 2+)


def _scan_existing(graph_mode: bool = False) -> None:
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
    # Scan graph dirs in graph mode
    if graph_mode:
        for d in GRAPH_DIRS:
            if not d.exists():
                continue
            for p in d.rglob("*"):
                if not _is_graphable(p):
                    continue
                h = _file_hash(p)
                key = str(p.resolve())
                if g_graph_hashes.get(key) != h:
                    g_graph_hashes[key] = h
                    logger.info("Found existing graph file: %s", p.relative_to(REPO))
                    _schedule_graph(str(p.relative_to(REPO)))
    # Flush immediately for --once mode
    _flush_pending()
    if graph_mode:
        _flush_graph_pending()


# ── Watchdog-based observer ──

def _watch_with_watchdog(graph_mode: bool = False) -> None:
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
    if graph_mode:
        for d in GRAPH_DIRS:
            if d.exists():
                observer.schedule(Handler(), str(d), recursive=True)
                logger.info("Watching %s for graph changes (debounce=%.1fs)", d, g_GRAPH_DEBOUNCE_SEC)
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

def _watch_with_polling(interval: float = 5.0, graph_mode: bool = False) -> None:
    """Simple polling fallback when watchdog is unavailable."""
    logger.info("Using polling watcher (interval=%.1fs)", interval)
    known: dict[str, float] = {}
    graph_known: dict[str, float] = {}

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

    def scan_graph():
        if not graph_mode:
            return
        current: dict[str, float] = {}
        for d in GRAPH_DIRS:
            if not d.exists():
                continue
            for p in d.rglob("*"):
                if not _is_graphable(p):
                    continue
                key = str(p.resolve())
                try:
                    mtime = p.stat().st_mtime
                except OSError:
                    continue
                current[key] = mtime
                if key not in graph_known:
                    _on_created(p)
                elif graph_known[key] != mtime:
                    _on_modified(p)
        for key in list(graph_known.keys()):
            if key not in current:
                _on_deleted(Path(key))
        graph_known.clear()
        graph_known.update(current)

    scan()  # initial scan
    scan_graph()
    try:
        while True:
            time.sleep(interval)
            scan()
            scan_graph()
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
    parser.add_argument("--graph", action="store_true", help="Also watch code dirs and auto-rebuild graph on change")
    args = parser.parse_args()

    g_DEBOUNCE_SEC = args.debounce

    if args.once:
        _scan_existing(graph_mode=args.graph)
        return

    if args.daemon:
        # Detach from terminal
        if os.name != "nt":
            import daemon
            with daemon.DaemonContext():
                _watch_with_polling(graph_mode=args.graph) if args.poll else _watch_with_watchdog(graph_mode=args.graph)
        else:
            logger.warning("--daemon not supported on Windows, running in foreground")

    if args.poll:
        _watch_with_polling(graph_mode=args.graph)
    else:
        try:
            _watch_with_watchdog(graph_mode=args.graph)
        except ImportError:
            logger.warning("watchdog not available, falling back to polling")
            _watch_with_polling(graph_mode=args.graph)


if __name__ == "__main__":
    main()
