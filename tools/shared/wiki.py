#!/usr/bin/env python3
"""Shared wiki utilities for tools/ scripts.

This module centralizes common operations (reading pages, extracting wikilinks,
scanning the wiki directory, etc.) to eliminate duplication across tools.

All functions are pure or operate only on the filesystem; no LLM calls here.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Iterator

REPO_ROOT = Path(__file__).parent.parent.parent
WIKI_DIR = REPO_ROOT / "wiki"
GRAPH_DIR = REPO_ROOT / "graph"
INDEX_FILE = WIKI_DIR / "index.md"
LOG_FILE = WIKI_DIR / "log.md"

# Files that should be excluded from wiki page scans
META_FILES = {"index.md", "log.md", "lint-report.md", "health-report.md"}


def read_file(path: Path) -> str:
    """Read text from *path* if it exists, otherwise return empty string."""
    return path.read_text(encoding="utf-8") if path.exists() else ""


def write_file(path: Path, content: str) -> None:
    """Write *content* to *path*, creating parent directories as needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def extract_wikilinks(content: str) -> list[str]:
    """Extract all [[WikiLink]] targets from page content.

    Handles both ``[[PageName]]`` and ``[[PageName|display alias]]`` formats.
    Returns the raw link text (including alias if present).
    """
    return re.findall(r'\[\[([^\]]+)\]\]', content)


def resolve_wikilink_target(link: str) -> str:
    """Return the page name portion of a wikilink, stripping any display alias."""
    return link.split("|")[0].strip()


def all_wiki_pages() -> Iterator[Path]:
    """Yield all .md files in wiki/, excluding meta files and agent internals."""
    for p in WIKI_DIR.rglob("*.md"):
        if p.name not in META_FILES and ".agent" not in p.parts:
            yield p


def all_wiki_page_stems() -> set[str]:
    """Return a case-insensitive set of all wiki page stems."""
    return {p.stem.lower() for p in all_wiki_pages()}


def strip_frontmatter(content: str) -> str:
    """Remove YAML frontmatter (--- ... ---) from content.

    Handles frontmatter values that contain '---' by matching the first
    newline-delimited --- boundary after the opening ---.
    """
    if content.startswith("---"):
        match = re.search(r"^---\s*$", content[3:], re.MULTILINE)
        if match:
            return content[3 + match.end():].strip()
    return content.strip()


def extract_frontmatter_type(content: str) -> str:
    """Return the ``type`` field from YAML frontmatter, or ``'unknown'``."""
    match = re.search(r'^type:\s*(\S+)', content, re.MULTILINE)
    return match.group(1).strip('"\'') if match else "unknown"


def extract_frontmatter_title(content: str) -> str:
    """Return the ``title`` field from YAML frontmatter, or empty string.

    Tries YAML parsing first for robust multi-line support, then falls back
    to a simple regex for single-line titles.
    """
    if content.startswith("---"):
        try:
            import yaml
            match = re.search(r'^---\n(.*?)\n---', content, re.DOTALL)
            if match:
                fm = yaml.safe_load(match.group(1))
                if isinstance(fm, dict):
                    title = fm.get("title", "")
                    if isinstance(title, str):
                        return title.strip()
        except Exception:
            pass
    # Fallback to regex for single-line titles
    match = re.search(r'^title:\s*["\']?(.+?)["\']?(?:\s*$|(?=\n\w+:|$))', content, re.MULTILINE)
    return match.group(1).strip() if match else ""


def page_id(path: Path) -> str:
    """Generate a canonical node ID from a wiki page path.

    Example: ``wiki/concepts/Transformer.md`` → ``concepts/Transformer``
    """
    return path.relative_to(WIKI_DIR).as_posix().replace(".md", "")


def page_name_to_path(name: str, pages: list[Path]) -> list[Path]:
    """Find page(s) whose stem matches *name* (case-insensitive)."""
    candidates = []
    for p in pages:
        if p.stem.lower() == name.lower() or p.stem == name:
            candidates.append(p)
    return candidates
