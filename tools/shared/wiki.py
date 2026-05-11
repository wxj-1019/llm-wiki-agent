#!/usr/bin/env python3
"""Shared wiki utilities for tools/ scripts.

This module centralizes common operations (reading pages, extracting wikilinks,
scanning the wiki directory, etc.) to eliminate duplication across tools.

All functions are pure or operate only on the filesystem; no LLM calls here.
"""
from __future__ import annotations

import os
import re
import time
import tempfile
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
    if not path.exists():
        return ""
    try:
        size = path.stat().st_size
    except OSError:
        return ""
    if size > 50 * 1024 * 1024:
        raise ValueError(f"File too large ({size / 1024 / 1024:.1f}MB > 50MB): {path}")
    return path.read_text(encoding="utf-8")


def write_file(path: Path, content: str) -> None:
    """Write *content* to *path* atomically, creating parent directories as needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    dir_path = str(path.parent)
    fd, tmp_path = tempfile.mkstemp(dir=dir_path, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp_path, str(path))
    except BaseException:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def extract_wikilinks(content: str) -> list[str]:
    """Extract all [[WikiLink]] targets from page content.

    Handles ``[[PageName]]``, ``[[PageName|display alias]]``,
    and ``[[PageName#heading]]`` formats.
    Returns the raw link text (including alias / anchor if present).
    """
    # Non-greedy match for link body; exclude nested [[ to avoid false matches
    return re.findall(r'\[\[([^\[\]]+?)\]\]', content)


def resolve_wikilink_target(link: str) -> str:
    """Return the page name portion of a wikilink, stripping alias and heading anchor."""
    # [[PageName|alias]] -> PageName
    # [[PageName#heading|alias]] -> PageName
    target = link.split("|")[0].strip()
    # Strip heading anchor: PageName#heading -> PageName
    return target.split("#")[0].strip()


_pages_cache: list[Path] | None = None
_pages_cache_time: float = 0
_PAGES_CACHE_TTL = 5.0


def all_wiki_pages() -> Iterator[Path]:
    """Yield all .md files in wiki/, excluding meta files and agent internals."""
    global _pages_cache, _pages_cache_time
    now = time.monotonic()
    if _pages_cache is not None and now - _pages_cache_time < _PAGES_CACHE_TTL:
        yield from _pages_cache
        return
    pages = [p for p in WIKI_DIR.rglob("*.md")
             if p.name not in META_FILES and ".agent" not in p.parts]
    _pages_cache = pages
    _pages_cache_time = now
    yield from pages


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


def normalize_wikilinks(content: str, canonical_map: dict[str, str] | None = None) -> str:
    """Replace wikilink targets with canonical forms matching actual file stems.

    Fixes common LLM mismatches like ``[[Hyperledger Fabric]]`` → ``[[HyperledgerFabric]]``
    by looking up the space-stripped / dash-stripped target against known page stems.
    """
    if canonical_map is None:
        canonical_map = {}
        for p in all_wiki_pages():
            stem = p.stem
            canonical_map[stem.lower()] = stem
            canonical_map[stem.lower().replace(" ", "").replace("-", "")] = stem

    def _repl(m: re.Match) -> str:
        inner = m.group(1)
        if "|" in inner:
            target, alias = inner.split("|", 1)
        else:
            target, alias = inner, None
        norm = target.lower().replace(" ", "").replace("-", "")
        if norm in canonical_map and canonical_map[norm] != target:
            new_target = canonical_map[norm]
            return f"[[{new_target}|{alias}]]" if alias else f"[[{new_target}]]"
        return m.group(0)

    return re.sub(r'\[\[([^\]]+)\]\]', _repl, content)
