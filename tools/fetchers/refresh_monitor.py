#!/usr/bin/env python3
"""Refresh monitor for web-fetched wiki sources.

Periodically checks URLs in raw-inbox/state.json for changes via
ETag/Last-Modified and re-ingests updated pages into wiki/sources/.

Usage:
    python tools/fetchers/refresh_monitor.py
    python tools/fetchers/refresh_monitor.py --dry-run
    python tools/fetchers/refresh_monitor.py --interval 3600  # seconds
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
STATE_PATH = REPO_ROOT / "raw-inbox" / "state.json"


def load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_state(state: dict[str, Any]) -> None:
    tmp = STATE_PATH.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    tmp.replace(STATE_PATH)


def _check_url_changed(url: str, meta: dict[str, str], timeout: int = 30) -> bool:
    """Return True if the remote resource has changed compared to stored meta."""
    etag = meta.get("etag", "")
    last_modified = meta.get("last_modified", "")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5,zh-CN;q=0.3",
    }
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified

    try:
        with httpx.Client(http2=True, timeout=timeout, follow_redirects=True) as client:
            # Try HEAD first to save bandwidth; fall back to GET if HEAD is not allowed
            try:
                resp = client.head(url, headers=headers)
                if resp.status_code == 405:
                    resp = client.get(url, headers=headers)
            except Exception:
                resp = client.get(url, headers=headers)

            if resp.status_code == 304:
                return False

            new_etag = resp.headers.get("etag", "")
            new_lm = resp.headers.get("last-modified", "")

            # If server returned same etag/lm, treat as unchanged
            if etag and new_etag and etag == new_etag:
                return False
            if last_modified and new_lm and last_modified == new_lm:
                return False

            # If no conditional headers were sent, compare content fingerprint
            if not etag and not last_modified:
                body = resp.text
                normalized = re.sub(r"\s+", " ", body.lower())[:1024].strip()
                fp = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]
                old_fp = meta.get("content_fp", "")
                return fp != old_fp

            # ETag/LM differ → changed
            return True
    except Exception as e:
        print(f"  [WARN] Check failed for {url}: {e}")
        return False


async def _reingest_url(url: str, use_browser: bool = False, use_llm: bool = True) -> bool:
    """Re-ingest a single URL via web_fetcher."""
    import subprocess
    cmd = [
        sys.executable, "-m", "tools.fetchers.web_fetcher",
        "--url", url,
        "--wiki",
    ]
    if use_browser:
        cmd.append("--browser")
    if use_llm:
        cmd.append("--llm")
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        out = stdout.decode("utf-8", errors="replace")
        err = stderr.decode("utf-8", errors="replace")
        if proc.returncode == 0 and "[OK]" in out:
            print(f"  [RE-INGESTED] {url}")
            return True
        else:
            print(f"  [FAIL] Re-ingest failed for {url}")
            if err:
                print(f"    {err[:200]}")
            return False
    except Exception as e:
        print(f"  [FAIL] Exception re-ingesting {url}: {e}")
        return False


def _update_refresh_log(urls_checked: int, urls_changed: int, urls_reingested: int, dry_run: bool) -> None:
    log_path = REPO_ROOT / "wiki" / "log.md"
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
    op = "refresh" if not dry_run else "refresh-dry"
    entry = f"## [{today}] {op} | Checked {urls_checked}, changed {urls_changed}, re-ingested {urls_reingested}\n"
    if log_path.exists():
        text = log_path.read_text(encoding="utf-8")
        log_path.write_text(text + "\n" + entry, encoding="utf-8")
    else:
        log_path.write_text("# Wiki Log\n\n" + entry, encoding="utf-8")


async def run_refresh(
    dry_run: bool = False,
    use_browser: bool = False,
    use_llm: bool = True,
) -> tuple[int, int, int]:
    """Run one refresh pass. Returns (checked, changed, reingested)."""
    state = load_state()
    processed = state.get("processed_urls", {})
    url_meta = state.get("url_meta", {})

    if not processed:
        print("No processed URLs to refresh.")
        return 0, 0, 0

    checked = 0
    changed = 0
    reingested = 0

    print(f"Checking {len(processed)} URLs for changes...\n")

    for url in list(processed.keys()):
        checked += 1
        meta = url_meta.get(url, {})
        print(f"[{checked}/{len(processed)}] {url}")

        if _check_url_changed(url, meta):
            changed += 1
            print(f"  [CHANGED] Content updated")
            if not dry_run:
                ok = await _reingest_url(url, use_browser=use_browser, use_llm=use_llm)
                if ok:
                    reingested += 1
            else:
                print(f"  [DRY] Would re-ingest")
        else:
            print(f"  [OK] No change")

    _update_refresh_log(checked, changed, reingested, dry_run)
    print(f"\nDone. Checked: {checked}, Changed: {changed}, Re-ingested: {reingested}")
    return checked, changed, reingested


async def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh monitor for web-fetched wiki sources")
    parser.add_argument("--dry-run", action="store_true", help="Report changes without re-ingesting")
    parser.add_argument("--interval", type=int, default=0, help="Run periodically every N seconds (0=once)")
    parser.add_argument("--browser", action="store_true", help="Use Playwright browser for re-ingest")
    parser.add_argument("--llm", action="store_true", default=True, help="Enable LLM extraction for re-ingest")
    parser.add_argument("--no-llm", action="store_true", dest="no_llm", help="Disable LLM extraction for re-ingest")
    args = parser.parse_args()

    use_llm = not args.no_llm

    if args.interval > 0:
        print(f"Starting refresh monitor (interval={args.interval}s, dry_run={args.dry_run})")
        while True:
            await run_refresh(dry_run=args.dry_run, use_browser=args.browser, use_llm=use_llm)
            print(f"\nSleeping {args.interval}s...")
            await asyncio.sleep(args.interval)
    else:
        await run_refresh(dry_run=args.dry_run, use_browser=args.browser, use_llm=use_llm)

    return 0


if __name__ == "__main__":
    asyncio.run(main())
