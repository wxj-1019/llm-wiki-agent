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
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import feedparser
import httpx
import trafilatura

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()

# Ensure REPO_ROOT is on sys.path so 'from tools.fetchers.llm_extractor' works
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

STATE_PATH = REPO_ROOT / "raw-inbox" / "state.json"
OUT_DIR = REPO_ROOT / "raw-inbox" / "fetched" / "rss"

logger = logging.getLogger("rss_fetcher")

# Lazy LLM extractor singleton
_llm_extractor = None


def _get_extractor(config: dict | None = None):
    """Lazy-init the LLM extractor singleton."""
    global _llm_extractor
    if _llm_extractor is None:
        from tools.fetchers.llm_extractor import LLMExtractor
        _llm_extractor = LLMExtractor(config)
    return _llm_extractor


# ── State management ──────────────────────────────────────────────────
def _load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"processed_urls": {}, "last_runs": {}}


def _save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(
        json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8"
    )


# ── Helpers ───────────────────────────────────────────────────────────
def _slugify(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text.lower())
    text = re.sub(r"[-\s]+", "-", text).strip("-")
    return text[:80]


def _clean_field(val: str) -> str:
    """Escape a string for YAML frontmatter double-quoted value."""
    return val.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")


# ── Core fetching logic ───────────────────────────────────────────────
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


def _trafilatura_extract(html: str) -> str | None:
    """Synchronous trafilatura extraction (run in thread pool)."""
    return trafilatura.extract(
        html,
        include_comments=False,
        include_tables=True,
        include_images=False,
        output_format="markdown",
    )


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
    extractor_config: dict | None = None,
    sem: asyncio.Semaphore | None = None,
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

    # Dedup check
    state = _load_state()
    if link and link in state["processed_urls"]:
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
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    date_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    slug = _slugify(title) or "untitled"
    filename = f"{date_prefix}-{slug}.md"
    out_path = OUT_DIR / filename
    counter = 1
    while out_path.exists():
        filename = f"{date_prefix}-{slug}-{counter}.md"
        out_path = OUT_DIR / filename
        counter += 1

    # Build frontmatter
    fm_lines = [
        f'title: "{_clean_field(title)}"',
        f'source_url: "{_clean_field(link)}"',
        f'published: "{_clean_field(published)}"',
        f'fetched_at: "{datetime.now(timezone.utc).isoformat()}"',
        f'source_type: "rss"',
        f'feed_name: "{_clean_field(feed_name)}"',
        f'extractor: "{article["extractor"]}"',
    ]
    if article["summary"]:
        fm_lines.append(f'summary: "{_clean_field(article["summary"])}"')
    if article["entities"]:
        entities_str = ", ".join(article["entities"])
        fm_lines.append(f'entities: "{_clean_field(entities_str)}"')
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

    # Update state
    state = _load_state()
    state["processed_urls"][link] = str(out_path.relative_to(REPO_ROOT).as_posix())
    _save_state(state)
    return out_path


# ── Main entry point ──────────────────────────────────────────────────
async def run_async(config_path: Path, max_per_feed: int) -> int:
    """Async main: fetch all feeds, process entries concurrently."""
    import yaml
    try:
        cfg = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    except Exception:
        cfg = json.loads(config_path.read_text(encoding="utf-8"))

    feeds = cfg.get("feeds", [])
    if not feeds:
        print("No feeds configured.", file=sys.stderr)
        return 1

    # Load extractor config if available
    scraper_cfg_path = REPO_ROOT / "config" / "scraper_config.yaml"
    extractor_config = None
    if scraper_cfg_path.exists():
        try:
            extractor_config = yaml.safe_load(scraper_cfg_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    sem = asyncio.Semaphore(5)  # max concurrent HTTP requests
    max_concurrent_http = extractor_config.get("scraper", {}).get("rate_limit", {}).get("max_concurrent_http", 5) if extractor_config else 5
    sem = asyncio.Semaphore(max_concurrent_http)

    total_new = 0
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for feed_cfg in feeds:
            name = feed_cfg.get("name", "unnamed")
            url = feed_cfg["url"]
            print(f"Fetching: {name} ({url})")

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
                    print(f"  -> no entries")
                    continue

                # Process entries concurrently
                tasks = [
                    _process_entry(entry, name, client, extractor_config, sem)
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
                    print(f"  -> no new entries")

            except Exception as e:
                logger.error(f"Feed '{name}' failed: {e}")
                print(f"  -> ERROR: {e}", file=sys.stderr)

    state = _load_state()
    state["last_runs"]["rss"] = datetime.now(timezone.utc).isoformat()
    _save_state(state)
    print(f"\nDone. Total new entries: {total_new}")
    return 0


def run(config_path: Path, max_per_feed: int) -> int:
    """Synchronous wrapper for run_async."""
    return asyncio.run(run_async(config_path, max_per_feed))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch RSS feeds for LLM Wiki Agent (v2)")
    parser.add_argument("--config", type=Path, required=True, help="Path to YAML/JSON config file")
    parser.add_argument("--max-per-feed", type=int, default=10, help="Max entries per feed")
    args = parser.parse_args()
    sys.exit(run(args.config, args.max_per_feed))