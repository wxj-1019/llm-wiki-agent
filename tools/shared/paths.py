#!/usr/bin/env python3
"""Path safety utilities for wiki tools."""
from __future__ import annotations

from pathlib import Path


def sanitize_wiki_path(path_str: str, base_dir: Path) -> Path:
    """Ensure a user-supplied path stays within base_dir.

    Resolves the combined path and verifies it is a descendant of base_dir.
    Raises ValueError if the path escapes (directory traversal attempt).
    """
    if not path_str or path_str in (".", ".."):
        raise ValueError(f"Invalid path: {path_str!r}")

    # Strip leading slashes and backslashes to prevent absolute-path injection
    path_str = path_str.lstrip("/\\")

    target = (base_dir / path_str).resolve()
    base = base_dir.resolve()

    try:
        target.relative_to(base)
    except ValueError:
        raise ValueError(
            f"Path traversal blocked: {path_str!r} resolves outside {base}"
        )
    return target


def safe_filename(name: str) -> str:
    """Sanitize a string for use as a filename (not a full path)."""
    safe = name.replace("/", "_").replace("\\", "_")
    safe = safe.replace("..", "_")
    safe = "".join(ch for ch in safe if ord(ch) > 31)
    safe = safe.strip()
    if not safe:
        raise ValueError("Filename is empty after sanitization")
    _WINDOWS_RESERVED = {
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    }
    stem = safe.rsplit(".", 1)[0].upper() if "." in safe else safe.upper()
    if stem in _WINDOWS_RESERVED:
        safe = f"_{safe}"
    return safe
