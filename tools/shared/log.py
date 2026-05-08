#!/usr/bin/env python3
"""Shared log-append utilities for tools/ scripts."""
from __future__ import annotations

import os
import tempfile
import threading
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
WIKI_DIR = REPO_ROOT / "wiki"
LOG_FILE = WIKI_DIR / "log.md"
_LOCK = threading.Lock()
_FILE_LOCK_SUFFIX = ".lock"

LOG_HEADER = (
    "# Wiki Log\n\n"
    "> Append-only chronological record of all operations.\n\n"
    "Format: `## [YYYY-MM-DD] <operation> | <title>`\n\n"
    "Parse recent entries: `grep \"^## \\[\" wiki/log.md | tail -10`\n\n"
    "---\n"
)


def _acquire_file_lock(lock_path: Path, timeout: float = 5.0) -> int:
    import time
    deadline = time.monotonic() + timeout
    fd = -1
    while time.monotonic() < deadline:
        try:
            fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode())
            return fd
        except FileExistsError:
            time.sleep(0.05)
    raise TimeoutError(f"Could not acquire lock {lock_path} within {timeout}s")


def _release_file_lock(lock_path: Path, fd: int) -> None:
    try:
        if fd >= 0:
            os.close(fd)
        os.unlink(str(lock_path))
    except OSError:
        pass


def _atomic_write(path: Path, content: str) -> None:
    dir_path = str(path.parent)
    fd_num, tmp_path = tempfile.mkstemp(dir=dir_path, suffix=".tmp")
    try:
        with os.fdopen(fd_num, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp_path, str(path))
    except BaseException:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def _read_file(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def append_log(entry: str) -> None:
    """Append entry to wiki/log.md (idempotent, thread-safe, file-safe)."""
    entry_text = entry.strip()
    if not entry_text:
        return

    lock_path = LOG_FILE.parent / (LOG_FILE.name + _FILE_LOCK_SUFFIX)
    fd = -1
    try:
        fd = _acquire_file_lock(lock_path)
        with _LOCK:
            _append_log_inner(entry_text)
    finally:
        _release_file_lock(lock_path, fd)


def _append_log_inner(entry_text: str) -> None:
    today = datetime.now().strftime("%Y-%m-%d")

    if not LOG_FILE.exists():
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        _atomic_write(LOG_FILE, LOG_HEADER + "\n" + entry_text + "\n")
        return

    existing = _read_file(LOG_FILE).strip()

    if entry_text in existing:
        return

    header_date = f"## [{today}]"
    if header_date not in existing:
        date_section = f"\n## [{today}]\n\n"
    else:
        date_section = ""

    new_content = existing.rstrip() + "\n" + date_section + entry_text + "\n"
    _atomic_write(LOG_FILE, new_content)


def get_recent_logs(n: int = 10) -> list[str]:
    """Return the last *n* log entries (lines starting with ``## [``)."""
    if not LOG_FILE.exists():
        return []
    lines = LOG_FILE.read_text(encoding="utf-8").splitlines()
    entries = [line for line in lines if line.startswith("## [")]
    return entries[-n:]
