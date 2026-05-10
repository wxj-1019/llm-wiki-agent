#!/usr/bin/env python3
"""Fetch RSS/Atom feeds and save entries as markdown for later batch ingestion.

V2: Now follows <link> to fetch full articles via LLM extraction.

Usage:
    python tools/fetchers/rss_fetcher.py --config config/rss_sources.yaml [--max-per-feed 10]

Dependencies: feedparser, httpx, trafilatura, litellm (via llm_extractor)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import feedparser
import httpx
import trafilatura

from tools.fetchers._common import (
    REPO_ROOT,
    content_fingerprint,
    escape_yaml_value,
    load_config,
    load_state,
    safe_write_path,
    save_state,
)

OUT_DIR = REPO_ROOT / "raw-inbox" / "fetched" / "rss"

logger = logging.getLogger("rss_fetcher")

_llm_extractor = None


def _get_extractor(config: dict | None = None):
    """Lazy-init the LLM extractor singleton."""
    global _llm_extractor
    if _llm_extractor is None:
        from tools.fetchers.llm_extractor import LLMExtractor
        _llm_extractor = LLMExtractor(config)
    return _llm_extractor


class RSSFeedMetrics:
    """Track per-feed metrics for adaptive scheduling."""

    def __init__(self, state_file: Path | None = None):
        self._state_file = state_file or (REPO_ROOT / "state" / "rss_feed_metrics.json")
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        try:
            self._state = json.loads(self._state_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            self._state = {}

    def record(self, feed_url: str, success: bool, duration: float = 0, items: int = 0):
        if feed_url not in self._state:
            self._state[feed_url] = {
                "successes": 0, "failures": 0,
                "total_items": 0, "avg_duration": 0,
                "consecutive_failures": 0,
                "last_fetched": "",
            }
        info = self._state[feed_url]
        info["last_fetched"] = datetime.now(timezone.utc).isoformat()
        if success:
            info["successes"] = info.get("successes", 0) + 1
            info["total_items"] = info.get("total_items", 0) + items
            info["consecutive_failures"] = 0
            n = info["successes"]
            old_avg = info.get("avg_duration", 0)
            info["avg_duration"] = round(old_avg + (duration - old_avg) / n, 2)
        else:
            info["failures"] = info.get("failures", 0) + 1
            info["consecutive_failures"] = info.get("consecutive_failures", 0) + 1
        self._save()

    def should_skip(self, feed_url: str) -> tuple[bool, str]:
        info = self._state.get(feed_url)
        if not info:
            return False, "first run"
        if info.get("consecutive_failures", 0) >= 5:
            return True, f"consecutive failures: {info['consecutive_failures']}"
        total = info.get("successes", 0) + info.get("failures", 0)
        if total >= 10 and info.get("failures", 0) / total > 0.7:
            return True, f"failure rate: {info['failures']}/{total}"
        return False, "ok"

    def get_concurrency(self, feed_url: str) -> int:
        info = self._state.get(feed_url, {})
        avg_dur = info.get("avg_duration", 10)
        if avg_dur < 3:
            return 3
        if avg_dur < 8:
            return 2
        return 1

    def _save(self):
        tmp = self._state_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._state, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self._state_file)


def _trafilatura_extract(html: str) -> str | None:
    """Synchronous trafilatura extraction (run in thread pool)."""
    return trafilatura.extract(
        html,
        include_comments=False,
        include_tables=True,
        include_images=False,
        output_format="markdown",
    )


async def _fetch_html(url: str, client: httpx.AsyncClient, max_retries: int = 3) -> str | None:
    """Fetch a URL with exponential backoff retry. Returns HTML string or None."""
    headers = {
        "User-Agent": "llm-wiki-agent/2.0 (+https://github.com/llm-wiki-agent)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }
    last_error = None
    for attempt in range(max_retries):
        try:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            return resp.text
        except Exception as e:
            last_error = str(e)
            if attempt < max_retries - 1:
                wait = 2 ** attempt  # 1s, 2s, 4s
                logger.warning(f"Fetch attempt {attempt+1} failed for {url}: {e}. Retrying in {wait}s")
                await asyncio.sleep(wait)
    logger.error(f"All {max_retries} attempts failed for {url}: {last_error}")
    return None


async def _extract_full_article(
    url: str,
    title: str,
    rss_body: str,
    client: httpx.AsyncClient,
    extractor_config: dict | None = None,
) -> dict[str, Any]:
    """Fetch full article from URL and extract content via trafilatura + optional LLM.

    Returns dict with keys: content, summary, entities, extractor, quality_score
    """
    result = {
        "content": rss_body,       # fallback
        "summary": "",
        "entities": [],
        "extractor": "raw",
        "quality_score": 0,
    }

    # Step 1: Fetch HTML (reuse shared client)
    html = await _fetch_html(url, client)
    if html is None:
        logger.info(f"HTTP fetch failed for {url}, using RSS body as fallback")
        return result

    # Step 2: trafilatura pre-extraction (run in thread pool to avoid blocking)
    loop = asyncio.get_running_loop()
    extracted = await loop.run_in_executor(None, _trafilatura_extract, html)
    if not extracted or len(extracted.strip()) < 100:
        logger.info(f"trafilatura extracted very little from {url}, falling back to LLM")
        extracted = ""

    # Step 3: Decision -- use trafilatura directly or invoke LLM?
    bypass_threshold = 1000
    if extractor_config:
        bypass_threshold = extractor_config.get("scraper", {}).get("quality", {}).get(
            "trafilatura_bypass_length", 1000
        )

    if extracted and len(extracted) >= bypass_threshold:
        result["content"] = extracted.strip()
        result["extractor"] = "trafilatura"
        result["quality_score"] = 70
        logger.info(f"trafilatura bypass: {len(extracted)} chars from {url}")
        return result

    # Step 4: LLM extraction
    try:
        extractor = _get_extractor(extractor_config)
        llm_result = await extractor.extract(html, url=url, title=title)
        if llm_result.content and len(llm_result.content) >= 100:
            result["content"] = llm_result.content
            result["summary"] = llm_result.summary
            result["entities"] = llm_result.entities
            result["extractor"] = "llm"
            result["quality_score"] = llm_result.quality.score if llm_result.quality else 70
            logger.info(f"LLM extraction: {len(llm_result.content)} chars from {url}")
        else:
            # LLM returned nothing useful, keep trafilatura or RSS body
            if extracted:
                result["content"] = extracted.strip()
                result["extractor"] = "trafilatura"
            logger.warning(f"LLM returned low-quality content for {url}, using fallback")
    except Exception as e:
        logger.error(f"LLM extraction failed for {url}: {e}")
        if extracted:
            result["content"] = extracted.strip()
            result["extractor"] = "trafilatura"

    return result


async def _process_entry(
    entry: feedparser.FeedParserDict,
    feed_name: str,
    client: httpx.AsyncClient,
    state: dict[str, Any],
    extractor_config: dict | None = None,
    sem: asyncio.Semaphore | None = None,
    out_dir: Path = OUT_DIR,
) -> Path | None:
    """Process a single RSS entry: extract metadata, fetch full article, write to disk."""
    title = entry.get("title", "Untitled").strip()
    link = entry.get("link", "")
    published = entry.get("published", "") or entry.get("updated", "")

    # RSS body (fallback)
    rss_body = ""
    if hasattr(entry, "content") and entry.content:
        rss_body = entry.content[0].get("value", "")
    elif hasattr(entry, "summary"):
        rss_body = entry.get("summary", "")
    if not rss_body:
        rss_body = entry.get("description", "")

    # Dedup check against in-memory state (loaded once at start)
    if link and link in state.get("processed_urls", {}):
        return None

    # Fetch full article
    if link and sem:
        async with sem:
            article = await _extract_full_article(link, title, rss_body, client, extractor_config)
    elif link:
        article = await _extract_full_article(link, title, rss_body, client, extractor_config)
    else:
        article = {
            "content": rss_body, "summary": "", "entities": [],
            "extractor": "raw", "quality_score": 0,
        }

    # Write markdown file
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = safe_write_path(out_dir, title)

    # Build frontmatter
    fm_lines = [
        f'title: "{escape_yaml_value(title)}"',
        f'source_url: "{escape_yaml_value(link)}"',
        f'published: "{escape_yaml_value(published)}"',
        f'fetched_at: "{datetime.now(timezone.utc).isoformat()}"',
        f'source_type: "rss"',
        f'feed_name: "{escape_yaml_value(feed_name)}"',
        f'extractor: "{article["extractor"]}"',
    ]
    if article["summary"]:
        fm_lines.append(f'summary: "{escape_yaml_value(article["summary"])}"')
    if article["entities"]:
        from tools.fetchers.llm_extractor import Entity
        ents = article["entities"]
        if ents and isinstance(ents[0], Entity):
            # Rich entity format: YAML list of inline mappings
            fm_lines.append("entities:")
            for e in ents:
                fm_lines.append(
                    f'  - {{name: "{escape_yaml_value(e.name)}", '
                    f'type: "{escape_yaml_value(e.type)}", '
                    f'wikilink: "{escape_yaml_value(e.wikilink or e.name)}"}}'
                )
        else:
            # Fallback: plain name list
            entities_str = ", ".join(str(e) for e in ents)
            fm_lines.append(f'entities: "{escape_yaml_value(entities_str)}"')
    if article["quality_score"]:
        fm_lines.append(f'quality_score: "{article["quality_score"]}"')

    fm_block = "\n".join(fm_lines)

    # Clean body (avoid breaking frontmatter)
    body_clean = article["content"].replace("---", chr(8212) * 3)

    content = f"""---
{fm_block}
---

{body_clean}
"""
    out_path.write_text(content, encoding="utf-8")

    # Update in-memory state (will be persisted once at the end)
    state["processed_urls"][link] = str(out_path.relative_to(REPO_ROOT).as_posix())
    return out_path


# ── Main entry point ──────────────────────────────────────────────────
async def run_async(config_path: Path, max_per_feed: int, output_dir: Path | None = None) -> int:
    """Async main: fetch all feeds, process entries concurrently."""
    cfg = load_config(config_path)
    feeds = cfg.get("feeds", [])
    if not feeds:
        print("No feeds configured.", file=sys.stderr)
        return 1

    # Load extractor config if available
    scraper_cfg_path = REPO_ROOT / "config" / "scraper_config.yaml"
    extractor_config = None
    if scraper_cfg_path.exists():
        try:
            extractor_config = load_config(scraper_cfg_path)
        except Exception:
            pass

    # Determine concurrency limit (fix: single assignment)
    max_concurrent_http = 5
    if extractor_config:
        max_concurrent_http = extractor_config.get("scraper", {}).get("rate_limit", {}).get("max_concurrent_http", 5)
    sem = asyncio.Semaphore(max_concurrent_http)

    # Load state once at the start to avoid race conditions
    state = load_state()
    feed_metrics = RSSFeedMetrics()

    total_new = 0
    limits = httpx.Limits(max_connections=20)
    async with httpx.AsyncClient(timeout=30, follow_redirects=True, limits=limits) as client:
        for feed_cfg in feeds:
            name = feed_cfg.get("name", "unnamed")
            url = feed_cfg["url"]

            skip, reason = feed_metrics.should_skip(url)
            if skip:
                print(f"Skipping: {name} ({reason})")
                continue

            print(f"Fetching: {name} ({url})")
            feed_start = time.monotonic()
            feed_success = False
            feed_items = 0

            # Feed-level error isolation
            try:
                # Parse feed (synchronous, but fast)
                parsed = await asyncio.get_running_loop().run_in_executor(
                    None, feedparser.parse, url
                )
                entries = parsed.entries[:max_per_feed]

                if not entries:
                    if parsed.bozo:
                        print(f"  Feed parser error: {parsed.bozo_exception}", file=sys.stderr)
                    print("  -> no entries")
                    feed_success = True
                    continue

                # Process entries concurrently
                tasks = [
                    _process_entry(entry, name, client, state, extractor_config, sem)
                    for entry in entries
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                new_files = [
                    r.name for r in results
                    if isinstance(r, Path) and r is not None
                ]
                errors = [r for r in results if isinstance(r, Exception)]
                if errors:
                    for err in errors:
                        logger.warning(f"Entry processing error in {name}: {err}")

                if new_files:
                    print(f"  -> {len(new_files)} new entries")
                    total_new += len(new_files)
                else:
                    print("  -> no new entries")

                feed_items = len(new_files)
                feed_success = True

            except Exception as e:
                logger.error(f"Feed '{name}' failed: {e}")
                print(f"  -> ERROR: {e}", file=sys.stderr)
            finally:
                elapsed = time.monotonic() - feed_start
                feed_metrics.record(url, feed_success, duration=elapsed, items=feed_items)

    # Persist state once at the end
    state["last_runs"]["rss"] = datetime.now(timezone.utc).isoformat()
    save_state(state)
    print(f"\nDone. Total new entries: {total_new}")
    return 0


def run(config_path: Path, max_per_feed: int, output_dir: Path | None = None) -> int:
    """Synchronous wrapper for run_async."""
    return asyncio.run(run_async(config_path, max_per_feed, output_dir))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch RSS feeds for LLM Wiki Agent (v2)")
    parser.add_argument("--config", type=Path, required=True, help="Path to YAML/JSON config file")
    parser.add_argument("--max-per-feed", type=int, default=10, help="Max entries per feed")
    parser.add_argument("--output-dir", type=Path, default=None, help="Override output directory")
    args = parser.parse_args()
    sys.exit(run(args.config, args.max_per_feed, args.output_dir))
