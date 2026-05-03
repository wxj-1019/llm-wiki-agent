#!/usr/bin/env python3
"""Shared log-append utilities for tools/ scripts."""
from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
WIKI_DIR = REPO_ROOT / "wiki"
LOG_FILE = WIKI_DIR / "log.md"

LOG_HEADER = (
    "# Wiki Log\n\n"
    "> Append-only chronological record of all operations.\n\n"
    "Format: `## [YYYY-MM-DD] <operation> | <title>`\n\n"
    "Parse recent entries: `grep \"^## \\[\" wiki/log.md | tail -10`\n\n"
    "---\n"
)


def _read_file(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def append_log(entry: str) -> None:
    """Prepend *entry* to the wiki log, preserving the header block."""
    entry_text = entry.strip()
    if not LOG_FILE.exists():
        LOG_FILE.write_text(LOG_HEADER + "\n" + entry_text + "\n", encoding="utf-8")
        return

    existing = _read_file(LOG_FILE).strip()
    if existing.startswith("# Wiki Log"):
        parts = existing.split("\n---\n", 1)
        if len(parts) == 2:
            new_content = parts[0] + "\n---\n\n" + entry_text + "\n\n" + parts[1].strip()
        else:
            new_content = entry_text + "\n\n" + existing
    else:
        new_content = entry_text + "\n\n" + existing

    LOG_FILE.write_text(new_content, encoding="utf-8")
