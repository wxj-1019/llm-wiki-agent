#!/usr/bin/env python3
"""
Refresh stale source pages by re-ingesting from raw documents.

Usage:
    python tools/refresh.py                     # refresh only changed sources
    python tools/refresh.py --force             # force re-ingest all sources
    python tools/refresh.py --page sources/X    # refresh a specific page

Compares raw document hashes against stored hashes to detect changes.
Re-ingests changed documents to update wiki/sources/ pages with accurate facts.
"""

import os
import sys
import json
import hashlib
import re
import subprocess
from typing import Optional
from pathlib import Path
from datetime import date

REPO_ROOT = Path(__file__).parent.parent
TOOLS_DIR = Path(__file__).parent
WIKI_DIR = REPO_ROOT / "wiki"
RAW_DIR = REPO_ROOT / "raw"
SOURCES_DIR = WIKI_DIR / "sources"
REFRESH_CACHE = REPO_ROOT / "graph" / ".refresh_cache.json"

try:
    from tools.shared.logging_config import get_logger
    logger = get_logger("refresh")
except ImportError:
    import logging
    logger = logging.getLogger("wiki.refresh")


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def read_file(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8") if path.exists() else ""
    except UnicodeDecodeError:
        return ""


def load_refresh_cache() -> dict:
    if REFRESH_CACHE.exists():
        try:
            data = json.loads(REFRESH_CACHE.read_text(encoding="utf-8"))
            logger.info("Refresh cache loaded | path=%s entries=%d", REFRESH_CACHE, len(data))
            return data
        except (json.JSONDecodeError, IOError) as e:
            logger.warning("Refresh cache load failed | path=%s error_type=%s error=%s",
                           REFRESH_CACHE, type(e).__name__, e)
            return {}
    return {}


def save_refresh_cache(cache: dict):
    REFRESH_CACHE.parent.mkdir(parents=True, exist_ok=True)
    REFRESH_CACHE.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")


def extract_source_file(content: str) -> Optional[str]:
    """Extract source_file from YAML frontmatter."""
    match = re.search(r'^source_file:\s*(.+)$', content, re.MULTILINE)
    if match:
        return match.group(1).strip().strip('"').strip("'").strip()
    return None


def find_stale_sources(force: bool = False) -> list[tuple[Path, Path]]:
    """Return list of (wiki_source_page, raw_document) pairs that need refresh."""
    cache = load_refresh_cache()
    stale = []

    if not SOURCES_DIR.exists():
        return stale

    for wiki_page in sorted(SOURCES_DIR.glob("*.md")):
        content = read_file(wiki_page)
        source_file = extract_source_file(content)
        if not source_file:
            continue

        # Resolve raw path and ensure it stays within project
        raw_path = (REPO_ROOT / source_file).resolve()
        try:
            raw_path.relative_to(REPO_ROOT.resolve())
        except ValueError:
            print(f"  [WARN] Skipping out-of-bounds source_file in {wiki_page.name}: {source_file}")
            continue
        if not raw_path.exists():
            # Try relative to raw/
            raw_path = (RAW_DIR / source_file).resolve()
            if not raw_path.exists():
                continue

        raw_content = read_file(raw_path)
        current_hash = sha256(raw_content)
        cached_hash = cache.get(str(raw_path))

        if force or cached_hash != current_hash:
            stale.append((wiki_page, raw_path))

    return stale


def refresh_page(wiki_page: Path, raw_path: Path) -> bool:
    """Re-ingest a single source document via subprocess."""
    try:
        print(f"\n{'='*60}")
        print(f"  Refreshing: {wiki_page.name}")
        print(f"  From:       {raw_path}")
        print(f"{'='*60}")
        logger.info("Refreshing page | wiki_page=%s raw_path=%s", wiki_page.name, raw_path)
        result = subprocess.run(
            [sys.executable, str(REPO_ROOT / "tools" / "ingest.py"), str(raw_path)],
            capture_output=True, text=True, cwd=str(REPO_ROOT), timeout=300
        )
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr)
        if result.returncode != 0:
            print(f"  [ERROR] Ingest subprocess failed with code {result.returncode}")
            logger.error("Ingest subprocess failed | wiki_page=%s returncode=%d stderr=%s",
                         wiki_page.name, result.returncode, result.stderr[:200])
            return False
        logger.info("Page refreshed successfully | wiki_page=%s", wiki_page.name)
        return True
    except subprocess.TimeoutExpired:
        print(f"  [ERROR] Ingest subprocess timed out for {wiki_page.name}")
        logger.error("Ingest subprocess timeout | wiki_page=%s", wiki_page.name)
        return False
    except Exception as e:
        print(f"  [ERROR] Failed to refresh {wiki_page.name}: {e}")
        logger.error("Page refresh failed | wiki_page=%s error_type=%s error=%s", wiki_page.name, type(e).__name__, e)
        return False


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Refresh stale wiki source pages")
    parser.add_argument("--force", action="store_true", help="Force re-ingest all sources")
    parser.add_argument("--page", type=str, help="Refresh a specific wiki source page (e.g., sources/my-page)")
    parser.add_argument("--dry-run", action="store_true", help="Only list stale pages, don't refresh")
    args = parser.parse_args()

    if args.page:
        # Refresh a single specific page
        wiki_page = WIKI_DIR / args.page
        if not wiki_page.suffix:
            wiki_page = wiki_page.with_suffix(".md")
        if not wiki_page.exists():
            raise RuntimeError(f"Page not found: {wiki_page}")
        content = read_file(wiki_page)
        source_file = extract_source_file(content)
        if not source_file:
            raise RuntimeError(f"Page has no source_file in frontmatter: {wiki_page}")
        raw_path = (REPO_ROOT / source_file).resolve()
        try:
            raw_path.relative_to(REPO_ROOT.resolve())
        except ValueError:
            raise RuntimeError(f"Could not resolve raw path for: {wiki_page}")
        if not raw_path.exists():
            raw_path = (RAW_DIR / source_file).resolve()
        if not raw_path.exists():
            raise RuntimeError(f"Could not resolve raw path for: {wiki_page}")
        stale = [(wiki_page, raw_path)]
    else:
        stale = find_stale_sources(force=args.force)

    if not stale:
        print("All source pages are up to date. Nothing to refresh.")
        logger.info("No stale pages found | force=%s", args.force)
        return

    print(f"Found {len(stale)} stale source page(s):")
    logger.info("Stale pages detected | count=%d force=%s", len(stale), args.force)
    for wiki_page, raw_path in stale:
        print(f"  • {wiki_page.name} ← {raw_path.relative_to(REPO_ROOT)}")
        logger.debug("Stale page | wiki_page=%s raw_path=%s", wiki_page.name, raw_path)

    if args.dry_run:
        print("\n[DRY RUN] No changes made.")
        logger.info("Dry run mode — no changes made")
        return

    cache = load_refresh_cache()
    refreshed = 0
    failed = 0

    for wiki_page, raw_path in stale:
        if refresh_page(wiki_page, raw_path):
            raw_content = read_file(raw_path)
            cache[str(raw_path)] = sha256(raw_content)
            refreshed += 1
        else:
            failed += 1

    save_refresh_cache(cache)

    print(f"\n{'='*60}")
    print(f"  Refresh complete: {refreshed} updated, {failed} failed")
    print(f"{'='*60}")
    logger.info("Refresh complete | refreshed=%d failed=%d total=%d", refreshed, failed, len(stale))


if __name__ == "__main__":
    main()
