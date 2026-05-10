#!/usr/bin/env python3
"""Refresh stale web-fetched articles by checking ETag/Last-Modified headers.

Usage:
    python tools/refresh_web.py                     # refresh changed sources
    python tools/refresh_web.py --dry-run           # show what would change
    python tools/refresh_web.py --force             # force re-fetch all
    python tools/refresh_web.py --config config/a_share_test_sources.yaml
    python tools/refresh_web.py --wiki              # also update wiki/sources/

Compares stored ETag/Last-Modified against current HEAD response.
Re-fetches changed documents and optionally updates wiki pages.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.resolve()
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import httpx

from tools.fetchers._common import REPO_ROOT as _REPO_ROOT, load_state, save_state

STATE_PATH = REPO_ROOT / "raw-inbox" / "state.json"


def _head_check(url: str, timeout: int = 15) -> dict[str, str]:
    """Send HEAD request and return current ETag/Last-Modified."""
    try:
        resp = httpx.head(url, timeout=timeout, follow_redirects=True)
        return {
            "etag": resp.headers.get("etag", ""),
            "last_modified": resp.headers.get("last-modified", ""),
            "status": str(resp.status_code),
        }
    except Exception as e:
        return {"etag": "", "last_modified": "", "status": f"error:{e}"}


def _has_changed(url: str, current: dict[str, str], stored: dict[str, str]) -> bool:
    """Compare current HEAD headers with stored ones."""
    if not stored.get("etag") and not stored.get("last_modified"):
        return True  # No stored metadata, treat as changed
    current_etag = current.get("etag", "")
    stored_etag = stored.get("etag", "")
    if current_etag and stored_etag and current_etag != stored_etag:
        return True
    current_lm = current.get("last_modified", "")
    stored_lm = stored.get("last_modified", "")
    if current_lm and stored_lm and current_lm != stored_lm:
        return True
    return False


async def refresh(
    config_path: Path | None = None,
    dry_run: bool = False,
    force: bool = False,
    write_wiki: bool = False,
    use_llm: bool = False,
) -> int:
    state = load_state()
    processed = state.get("processed_urls", {})
    url_meta = state.get("url_meta", {})

    if not processed:
        print("No processed URLs found in state.json. Run web_fetcher first.")
        return 0

    # If config provided, filter to those URLs
    urls_to_check = list(processed.keys())
    if config_path and config_path.exists():
        from tools.fetchers._common import load_config
        cfg = load_config(config_path)
        config_urls = {e.get("url", "") for e in cfg.get("urls", [])}
        urls_to_check = [u for u in urls_to_check if u in config_urls]

    changed: list[tuple[str, dict, dict]] = []
    unchanged = 0
    errors = 0

    print(f"Checking {len(urls_to_check)} URLs for changes...")
    for url in urls_to_check:
        stored = url_meta.get(url, {})
        current = _head_check(url)

        if not current["status"].startswith("2"):
            print(f"  [WARN] {url} — HEAD failed ({current['status']})")
            errors += 1
            continue

        if force or _has_changed(url, current, stored):
            changed.append((url, stored, current))
            print(f"  [CHANGED] {url}")
        else:
            unchanged += 1

    print(f"\nSummary: {len(changed)} changed, {unchanged} unchanged, {errors} errors")

    if not changed:
        print("Nothing to refresh.")
        return 0

    if dry_run:
        print("\n[DRY-RUN] Would re-fetch the following URLs:")
        for url, _, _ in changed:
            print(f"  - {url}")
        return 0

    # Re-fetch changed URLs using web_fetcher
    print(f"\nRe-fetching {len(changed)} changed URLs...")
    from tools.fetchers.web_fetcher import run as web_run

    for url, _, _ in changed:
        print(f"\n--- Refreshing: {url} ---")
        ret = web_run(
            config_path=None,
            single_url=url,
            max_urls=1,
            dry_run=False,
            write_report=False,
            use_browser=True,
            use_llm=use_llm,
            write_wiki=write_wiki,
        )
        if ret != 0:
            print(f"  [WARN] Refresh failed for {url}")

    # Update state timestamps
    state["last_runs"]["refresh_web"] = datetime.now(timezone.utc).isoformat()
    save_state(state)
    print("\nRefresh complete.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh stale web-fetched articles")
    parser.add_argument("--config", type=Path, help="Filter to URLs in this config file")
    parser.add_argument("--dry-run", action="store_true", help="Show what would change without fetching")
    parser.add_argument("--force", action="store_true", help="Re-fetch all URLs regardless of change status")
    parser.add_argument("--wiki", action="store_true", help="Also update wiki/sources/ pages")
    parser.add_argument("--llm", action="store_true", help="Enable LLM extraction for refreshed articles")
    args = parser.parse_args()

    return asyncio.run(refresh(
        config_path=args.config,
        dry_run=args.dry_run,
        force=args.force,
        write_wiki=args.wiki,
        use_llm=args.llm,
    ))


if __name__ == "__main__":
    sys.exit(main())
