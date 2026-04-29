#!/usr/bin/env python3
"""Parse wiki markdown files into structured data."""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.agent_kit.types import WikiPage

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore

logger = logging.getLogger(__name__)

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)", re.DOTALL)
WIKILINK_RE = re.compile(r"\[\[(.*?)\]\]")

# Pages that are meta-data only and should not be treated as knowledge pages
META_PAGES: frozenset[str] = frozenset({"index", "log", "health-report", "lint-report"})


def parse_page(path: Path, repo_root: Path | None = None) -> WikiPage | None:
    """Parse a single wiki page into structured data.

    Returns None if the file has no valid frontmatter or is a meta page.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        logger.warning("Failed to read %s: %s", path, exc)
        return None

    match = FRONTMATTER_RE.match(text)
    if not match:
        logger.debug("No frontmatter in %s", path)
        return None

    frontmatter_text = match.group(1)
    body = match.group(2).strip()

    if yaml is None:
        frontmatter: dict = {}
    else:
        try:
            frontmatter = yaml.safe_load(frontmatter_text) or {}
        except yaml.YAMLError as exc:
            logger.warning("Invalid YAML frontmatter in %s: %s", path, exc)
            frontmatter = {}

    slug = path.stem
    if slug in META_PAGES:
        return None

    # Extract wikilinks, handling [[Name|Display]] format
    raw_links = WIKILINK_RE.findall(body)
    seen: set[str] = set()
    clean_links: list[str] = []
    for link in raw_links:
        clean = link.split("|")[0].strip()
        if clean and clean not in seen:
            seen.add(clean)
            clean_links.append(clean)

    rel_path = str(path.relative_to(repo_root).as_posix()) if repo_root else str(path)

    return {
        "slug": slug,
        "path": rel_path,
        "title": frontmatter.get("title", slug),
        "type": frontmatter.get("type", "page"),
        "tags": frontmatter.get("tags", []) or [],
        "sources": frontmatter.get("sources", []) or [],
        "last_updated": frontmatter.get("last_updated", ""),
        "date": frontmatter.get("date", ""),
        "body": body,
        "body_length": len(body),
        "links": clean_links,
        "frontmatter": frontmatter,
    }


def parse_all_pages(wiki_root: Path, repo_root: Path | None = None) -> dict[str, WikiPage]:
    """Parse all markdown files in the wiki directory.

    Returns a dict mapping slug -> parsed page data.
    """
    if repo_root is None:
        repo_root = wiki_root.parent

    pages: dict[str, WikiPage] = {}
    for md_file in sorted(wiki_root.rglob("*.md")):
        page = parse_page(md_file, repo_root)
        if page:
            if page["slug"] in pages:
                logger.warning("Duplicate slug '%s' — overwriting", page["slug"])
            pages[page["slug"]] = page
    return pages
