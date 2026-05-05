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
import importlib.util
from typing import Optional
from pathlib import Path
from datetime import date

REPO_ROOT = Path(__file__).parent.parent
TOOLS_DIR = Path(__file__).parent
WIKI_DIR = REPO_ROOT / "wiki"
RAW_DIR = REPO_ROOT / "raw"
SOURCES_DIR = WIKI_DIR / "sources"
REFRESH_CACHE = REPO_ROOT / "graph" / ".refresh_cache.json"


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
            return json.loads(REFRESH_CACHE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, IOError):
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
    """Re-ingest a single source document."""
    # Import ingest module safely via importlib
    try:
        spec = importlib.util.spec_from_file_location("ingest", TOOLS_DIR / "ingest.py")
        if spec is None or spec.loader is None:
            print(f"  [ERROR] Could not load ingest module")
            return False
        ingest_mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(ingest_mod)
        print(f"\n{'='*60}")
        print(f"  Refreshing: {wiki_page.name}")
        print(f"  From:       {raw_path}")
        print(f"{'='*60}")
        ingest_mod.ingest(str(raw_path))
        return True
    except Exception as e:
        print(f"  [ERROR] Failed to refresh {wiki_page.name}: {e}")
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
            print(f"Page not found: {wiki_page}")
            sys.exit(1)
        content = read_file(wiki_page)
        source_file = extract_source_file(content)
        if not source_file:
            print(f"No source_file found in frontmatter of {wiki_page.name}")
            sys.exit(1)
        raw_path = (REPO_ROOT / source_file).resolve()
        try:
            raw_path.relative_to(REPO_ROOT.resolve())
        except ValueError:
            print(f"Error: source_file resolves outside repo: {source_file}")
            sys.exit(1)
        if not raw_path.exists():
            raw_path = (RAW_DIR / source_file).resolve()
        if not raw_path.exists():
            print(f"Raw document not found: {source_file}")
            sys.exit(1)
        stale = [(wiki_page, raw_path)]
    else:
        stale = find_stale_sources(force=args.force)

    if not stale:
        print("All source pages are up to date. Nothing to refresh.")
        return

    print(f"Found {len(stale)} stale source page(s):")
    for wiki_page, raw_path in stale:
        print(f"  • {wiki_page.name} ← {raw_path.relative_to(REPO_ROOT)}")

    if args.dry_run:
        print("\n[DRY RUN] No changes made.")
        return

    # Refresh each stale page
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


if __name__ == "__main__":
    main()
