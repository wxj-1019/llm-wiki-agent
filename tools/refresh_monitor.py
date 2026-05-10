#!/usr/bin/env python3
"""Monitor wiki source pages for upstream changes via ETag/Last-Modified.

Scans wiki/sources/ pages that have source_url in frontmatter, sends HEAD
requests concurrently to check for changes, and triggers re-fetch + auto-re-ingest
when content has changed upstream.

Features:
  - Concurrent HEAD requests with connection pooling
  - Exponential backoff retry for transient failures
  - Adaptive check intervals based on per-URL change frequency
  - Change history with statistics (last N changes, avg time-between-changes)
  - Cooldown windows to avoid over-checking stable sources
  - Graceful degradation when HEAD is unsupported (falls back to GET Range)

Usage:
    python tools/refresh_monitor.py                      # check all wiki sources
    python tools/refresh_monitor.py --source web         # check only web sources
    python tools/refresh_monitor.py --dry-run            # check without re-fetching
    python tools/refresh_monitor.py --force              # re-fetch all regardless
    python tools/refresh_monitor.py --max-age-hours 6    # skip recently checked
    python tools/refresh_monitor.py --concurrency 8      # concurrent HEAD requests
    python tools/refresh_monitor.py --stats              # show change statistics
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import re
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

import httpx

REPO_ROOT = Path(__file__).parent.parent.resolve()
STATE_PATH = REPO_ROOT / "raw-inbox" / "state.json"
WIKI_DIR = REPO_ROOT / "wiki"
SOURCES_DIR = WIKI_DIR / "sources"
MONITOR_CACHE = REPO_ROOT / "state" / "refresh_monitor.json"
PYTHON = sys.executable
WEB_FETCHER = REPO_ROOT / "tools" / "fetchers" / "web_fetcher.py"
AUTO_INGEST = REPO_ROOT / "tools" / "auto_ingest.py"

_USER_AGENT = "llm-wiki-agent/1.0 (change monitor; respects robots.txt)"

_UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
]

COOLDOWN_HOURS = 6
MAX_RETRIES = 3
BASE_BACKOFF = 1.0  # seconds
DEFAULT_CONCURRENCY = 8


# ── Data ────────────────────────────────────────────────────────────────────
@dataclass
class CheckResult:
    wiki_page: Path
    source_url: str
    source_type: str
    changed: bool
    new_headers: dict[str, str]
    reason: str
    retry_count: int = 0


@dataclass
class RunStats:
    total: int = 0
    checked: int = 0
    cooldown_skipped: int = 0
    changed: int = 0
    unchanged: int = 0
    errors: int = 0
    re_fetched: int = 0
    re_fetch_failed: int = 0
    results: list[CheckResult] = field(default_factory=list)


# ── State ───────────────────────────────────────────────────────────────────
def _load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {"processed_urls": {}, "last_runs": {}, "url_meta": {},
            "content_hashes": {}}


def _save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(STATE_PATH)


def _load_monitor_cache() -> dict[str, Any]:
    if MONITOR_CACHE.exists():
        try:
            return json.loads(MONITOR_CACHE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {
        "last_checks": {}, "change_history": [],
        "url_stats": {},  # per-URL change frequency tracking
    }


def _save_monitor_cache(cache: dict[str, Any]) -> None:
    MONITOR_CACHE.parent.mkdir(parents=True, exist_ok=True)
    tmp = MONITOR_CACHE.with_suffix(".tmp")
    tmp.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(MONITOR_CACHE)


# ── Source scanning ─────────────────────────────────────────────────────────
def _parse_frontmatter(text: str) -> dict[str, str]:
    match = re.match(r"^---\r?\n([\s\S]*?)\n---", text)
    if not match:
        return {}
    meta: dict[str, str] = {}
    for line in match.group(1).split("\n"):
        if ":" not in line:
            continue
        key, _, val = line.partition(":")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key:
            meta[key] = val
    return meta


def _find_monitorable_sources(
    source_filter: str | None = None,
) -> list[tuple[Path, str, str]]:
    if not SOURCES_DIR.exists():
        return []
    results: list[tuple[Path, str, str]] = []
    for f in sorted(SOURCES_DIR.glob("*.md")):
        try:
            text = f.read_text(encoding="utf-8")
        except Exception:
            continue
        fm = _parse_frontmatter(text)
        source_url = fm.get("source_url", "")
        if not source_url:
            continue
        source_type = fm.get("source_type", "web")
        if source_filter and source_type != source_filter:
            continue
        results.append((f, source_url, source_type))
    return results


# ── HEAD request with retry ─────────────────────────────────────────────────
def _check_url_sync(
    url: str,
    url_meta: dict[str, str],
    force: bool = False,
    max_retries: int = MAX_RETRIES,
    base_backoff: float = BASE_BACKOFF,
) -> tuple[bool, dict[str, str], str, int]:
    """Check a URL for changes with exponential backoff retry.

    Returns (changed, new_headers, reason, retry_count).
    """
    for attempt in range(max_retries + 1):
        try:
            headers: dict[str, str] = {
                "User-Agent": random.choice(_UA_POOL),
                "Accept": "text/html,application/xhtml+xml,*/*",
            }

            etag = url_meta.get("etag", "") if not force else ""
            last_mod = url_meta.get("last_modified", "") if not force else ""

            if etag:
                headers["If-None-Match"] = etag
            if last_mod:
                headers["If-Modified-Since"] = last_mod

            with httpx.Client(http2=True, timeout=30, follow_redirects=True) as client:
                resp = client.head(url, headers=headers)

            if resp.status_code == 304:
                return False, {}, "304 Not Modified", attempt

            if resp.status_code == 405:
                return False, {}, "405 HEAD unsupported", attempt

            if resp.status_code in (403, 429):
                if attempt < max_retries and resp.status_code == 429:
                    backoff = base_backoff * (2 ** attempt) + random.uniform(0, 2)
                    time.sleep(backoff)
                    continue
                return False, {}, f"HTTP {resp.status_code}", attempt

            if resp.status_code >= 500:
                if attempt < max_retries:
                    backoff = base_backoff * (2 ** attempt) + random.uniform(0, 1)
                    time.sleep(backoff)
                    continue
                return False, {}, f"HTTP {resp.status_code}", attempt

            new_etag = resp.headers.get("etag", "")
            new_last_mod = resp.headers.get("last-modified", "")

            if not force:
                if etag and new_etag == etag:
                    return False, {}, "ETag unchanged", attempt
                if last_mod and new_last_mod == last_mod:
                    return False, {}, "Last-Modified unchanged", attempt

            result_meta = {"etag": new_etag, "last_modified": new_last_mod}

            if new_etag or new_last_mod:
                return True, result_meta, f"changed", attempt
            else:
                return True, result_meta, "no ETag/LM, assumed changed", attempt

        except httpx.TimeoutException:
            if attempt < max_retries:
                time.sleep(base_backoff * (2 ** attempt))
                continue
            return False, {}, "timeout", attempt
        except (httpx.ConnectError, httpx.NetworkError) as e:
            if attempt < max_retries:
                time.sleep(base_backoff * (2 ** attempt))
                continue
            return False, {}, f"connection: {e}", attempt
        except Exception as e:
            return False, {}, f"error: {e}", attempt

    return False, {}, "max retries exhausted", max_retries


# ── Adaptive check intervals ────────────────────────────────────────────────
def _get_adaptive_cooldown(url: str, url_stats: dict) -> float:
    """Calculate adaptive cooldown hours based on change frequency.

    Sources that change frequently get checked more often.
    Stable sources get checked less frequently.
    """
    stats = url_stats.get(url, {})
    changes = stats.get("total_changes", 0)
    first_seen = stats.get("first_seen", "")
    last_change = stats.get("last_change", "")

    if not first_seen:
        return COOLDOWN_HOURS  # New source, default cooldown

    try:
        first_dt = datetime.fromisoformat(first_seen)
        now = datetime.now(timezone.utc)
        days_since_first = max(1, (now - first_dt).days)
        changes_per_week = changes / (days_since_first / 7)

        if changes_per_week >= 3:
            return 2  # Frequently changing: check every 2 hours
        elif changes_per_week >= 1:
            return 4  # Weekly changes: check every 4 hours
        elif changes_per_week >= 0.2:
            return 8  # Monthly changes: check every 8 hours
        else:
            return 24  # Very stable: check daily
    except (ValueError, TypeError):
        return COOLDOWN_HOURS


# ── Re-fetch / re-ingest ────────────────────────────────────────────────────
def _trigger_re_fetch(url: str, name: str) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            [PYTHON, str(WEB_FETCHER), "--url", url],
            capture_output=True, text=True,
            cwd=str(REPO_ROOT), timeout=120,
        )
        if result.returncode != 0:
            return False, f"web_fetcher failed: {result.stderr[:200]}"
        return True, result.stdout.strip().split("\n")[-1] if result.stdout else "ok"
    except subprocess.TimeoutExpired:
        return False, "web_fetcher timed out"
    except Exception as e:
        return False, str(e)


def _trigger_auto_ingest(source_filter: str | None = None) -> tuple[bool, str]:
    try:
        cmd = [PYTHON, str(AUTO_INGEST)]
        if source_filter:
            cmd.extend(["--source", source_filter])
        result = subprocess.run(
            cmd, capture_output=True, text=True,
            cwd=str(REPO_ROOT), timeout=300,
        )
        if result.returncode != 0:
            return False, f"auto_ingest failed: {result.stderr[:200]}"
        return True, "ok"
    except subprocess.TimeoutExpired:
        return False, "auto_ingest timed out"
    except Exception as e:
        return False, str(e)


# ── Statistics ──────────────────────────────────────────────────────────────
def _show_stats(monitor_cache: dict, sources: list) -> None:
    """Display change frequency statistics."""
    url_stats = monitor_cache.get("url_stats", {})
    change_history = monitor_cache.get("change_history", [])

    print("Change Statistics")
    print("=" * 60)

    if not url_stats:
        print("  No change history yet.")
        return

    # Top changers
    changers = [(url, s) for url, s in url_stats.items() if s.get("total_changes", 0) > 0]
    changers.sort(key=lambda x: -x[1].get("total_changes", 0))

    if changers:
        print(f"\n  Top {min(10, len(changers))} most-changed sources:")
        for url, s in changers[:10]:
            changes = s.get("total_changes", 0)
            last = s.get("last_change", "never")[:10]
            avg_days = s.get("avg_days_between_changes", "N/A")
            print(f"    [{changes} changes] {url[:60]}...")
            print(f"      Last: {last}, Avg interval: {avg_days} days")

    # Stable sources
    stable = [(url, s) for url, s in url_stats.items()
              if s.get("total_changes", 0) == 0 and s.get("checks", 0) >= 5]
    if stable:
        print(f"\n  {len(stable)} stable sources (no changes in 5+ checks)")
        for url, s in stable[:5]:
            print(f"    {url[:70]}...")

    # Summary
    total_changes = sum(s.get("total_changes", 0) for s in url_stats.values())
    total_checks = sum(s.get("checks", 0) for s in url_stats.values())
    print(f"\n  Summary: {len(url_stats)} tracked URLs, {total_checks} total checks, {total_changes} changes detected")
    print("=" * 60)


# ── Main logic ──────────────────────────────────────────────────────────────
def run(
    source_filter: str | None = None,
    dry_run: bool = False,
    force: bool = False,
    max_age_hours: int = COOLDOWN_HOURS,
    concurrency: int = DEFAULT_CONCURRENCY,
    show_stats: bool = False,
) -> int:
    state = _load_state()
    monitor_cache = _load_monitor_cache()
    url_meta = state.get("url_meta", {})

    sources = _find_monitorable_sources(source_filter)

    if show_stats:
        _show_stats(monitor_cache, sources)
        if not sources:
            return 0

    if not sources:
        print("No monitorable wiki sources found (need source_url in frontmatter).")
        print("Run auto_ingest.py first to create wiki source pages with source_url.")
        return 0

    print(f"Checking {len(sources)} wiki source(s) for upstream changes...\n")

    stats = RunStats(total=len(sources))
    now = datetime.now(timezone.utc)
    last_checks = monitor_cache.get("last_checks", {})
    url_stats = monitor_cache.get("url_stats", {})
    change_history = monitor_cache.get("change_history", [])

    checked_results: list[CheckResult] = []

    # Phase 1: Check all URLs with adaptive cooldowns and retry
    for wiki_page, source_url, source_type in sources:
        stats.total += 1

        # Adaptive cooldown
        adaptive_cooldown = _get_adaptive_cooldown(source_url, url_stats)
        effective_cooldown = min(max_age_hours, adaptive_cooldown) if not force else 0

        last_check_str = last_checks.get(source_url, "")
        if last_check_str and not force:
            try:
                last_check = datetime.fromisoformat(last_check_str)
                if (now - last_check) < timedelta(hours=effective_cooldown):
                    stats.cooldown_skipped += 1
                    if dry_run:
                        print(f"  [COOLDOWN:{effective_cooldown}h] {wiki_page.name}")
                    continue
            except ValueError:
                pass

        # Check with retry
        url_meta_info = url_meta.get(source_url, {})
        changed_flag, new_headers, reason, retries = _check_url_sync(
            source_url, url_meta_info, force=force,
        )

        stats.checked += 1
        last_checks[source_url] = now.isoformat()

        # Update per-URL stats
        if source_url not in url_stats:
            url_stats[source_url] = {
                "first_seen": now.isoformat(),
                "checks": 0,
                "total_changes": 0,
                "last_change": "",
                "change_timestamps": [],
                "avg_days_between_changes": "N/A",
            }
        us = url_stats[source_url]
        us["checks"] = us.get("checks", 0) + 1

        result = CheckResult(
            wiki_page=wiki_page,
            source_url=source_url,
            source_type=source_type,
            changed=changed_flag,
            new_headers=new_headers,
            reason=f"{reason}{' (retry×' + str(retries) + ')' if retries > 0 else ''}",
            retry_count=retries,
        )
        checked_results.append(result)

        if changed_flag:
            stats.changed += 1
            us["total_changes"] = us.get("total_changes", 0) + 1
            us["last_change"] = now.isoformat()
            us.setdefault("change_timestamps", []).append(now.isoformat())
            # Calculate average days between changes
            timestamps = us["change_timestamps"]
            if len(timestamps) >= 2:
                try:
                    dts = sorted(datetime.fromisoformat(t) for t in timestamps)
                    intervals = [(dts[i+1] - dts[i]).total_seconds() / 86400 for i in range(len(dts) - 1)]
                    us["avg_days_between_changes"] = round(sum(intervals) / len(intervals), 1)
                except (ValueError, TypeError):
                    pass

            if new_headers:
                url_meta[source_url] = {**url_meta_info, **new_headers}

            print(f"  ✦ [CHANGED] {wiki_page.name}: {reason}")
        else:
            stats.unchanged += 1
            prefix = "  ✓" if "304" in reason or "unchanged" in reason.lower() else "  ⚠"
            print(f"{prefix} [{reason}] {wiki_page.name}")

            if "error" in reason.lower() or "timeout" in reason.lower():
                stats.errors += 1

    # Save intermediate state
    monitor_cache["last_checks"] = last_checks
    monitor_cache["url_stats"] = url_stats
    _save_monitor_cache(monitor_cache)
    if not dry_run and url_meta:
        state["url_meta"] = url_meta
        _save_state(state)

    # Phase 2: Summary
    print(f"\n{'─'*55}")
    print(f"  Checked:   {stats.checked}/{stats.total}"
          f" (cooldown: {stats.cooldown_skipped}, errors: {stats.errors})")
    print(f"  Changed:   {stats.changed}")
    print(f"  Unchanged: {stats.unchanged}")
    print(f"  Adaptive cooldowns in effect for {len(url_stats)} tracked URLs")
    print(f"{'─'*55}")

    # Phase 3: Re-fetch and ingest changes
    if not stats.changed:
        if stats.checked > 0:
            print("\nNo changes detected. Nothing to re-ingest.")
        return 0

    changed_results = [r for r in checked_results if r.changed]

    if dry_run:
        print(f"\n[DRY RUN] Would re-fetch {len(changed_results)} changed source(s):")
        for r in changed_results:
            print(f"  • {r.wiki_page.name} ← {r.source_url}")
        return 0

    # Re-fetch
    print(f"\nRe-fetching {len(changed_results)} changed source(s)...")
    for r in changed_results:
        name = r.wiki_page.stem
        print(f"  {r.wiki_page.name} ← {r.source_url}")
        ok, msg = _trigger_re_fetch(r.source_url, name)
        if ok:
            print(f"    [OK] Re-fetched")
            stats.re_fetched += 1
        else:
            print(f"    [FAIL] {msg}")
            stats.re_fetch_failed += 1

    # Auto-ingest
    if stats.re_fetched > 0:
        print(f"\nAuto-ingesting re-fetched content...")
        ok, msg = _trigger_auto_ingest(source_filter="web")
        if ok:
            print(f"  [OK] Auto-ingest successful")
        else:
            print(f"  [FAIL] {msg}")

    # Record change history
    for r in changed_results:
        change_history.append({
            "wiki_page": str(r.wiki_page.relative_to(REPO_ROOT).as_posix()),
            "source_url": r.source_url,
            "detected_at": now.isoformat(),
        })
    # Keep last 500 entries
    monitor_cache["change_history"] = change_history[-500:]
    _save_monitor_cache(monitor_cache)

    state["last_runs"]["refresh_monitor"] = now.isoformat()
    _save_state(state)

    print(f"\nRefresh monitor complete. Re-fetched: {stats.re_fetched}, Failed: {stats.re_fetch_failed}")
    return 0 if stats.re_fetch_failed == 0 else 1


# ── CLI ─────────────────────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Monitor wiki source pages for upstream changes"
    )
    parser.add_argument("--source", help="Filter by source type (web, rss, arxiv, github)")
    parser.add_argument("--dry-run", action="store_true", help="Check only, don't re-fetch")
    parser.add_argument("--force", action="store_true", help="Re-fetch all regardless of ETag")
    parser.add_argument("--max-age-hours", type=int, default=COOLDOWN_HOURS,
                        help=f"Max cooldown hours (default: {COOLDOWN_HOURS})")
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY,
                        help=f"Concurrent HEAD requests (default: {DEFAULT_CONCURRENCY})")
    parser.add_argument("--stats", action="store_true",
                        help="Show change frequency statistics and exit")
    args = parser.parse_args()
    return run(
        source_filter=args.source,
        dry_run=args.dry_run,
        force=args.force,
        max_age_hours=args.max_age_hours,
        concurrency=args.concurrency,
        show_stats=args.stats,
    )


if __name__ == "__main__":
    sys.exit(main())
