#!/usr/bin/env python3
"""Crawl4AI vs self-built pipeline comparison test.

Runs the same URLs through both extraction engines and compares quality.
Usage:
    PYTHONIOENCODING=utf-8 python tools/test_crawl4ai_comparison.py
"""
from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.resolve()
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from tools.fetchers.web_fetcher import (
    _extract_with_trafilatura,
    _extract_with_scrapling,
    _score_quality,
)

TEST_URLS = [
    ("https://finance.sina.com.cn/stock/", "新浪-股票频道"),
    ("https://finance.eastmoney.com/a/202605093731914918.html", "东财-个股新闻"),
    ("http://www.sse.com.cn/", "上交所"),
    ("https://www.gelonghui.com/", "格隆汇"),
    ("https://data.eastmoney.com/stock/", "东财-数据中心"),
]


def _current_pipeline(html: str, url: str) -> dict:
    """Run current trafilatura → scrapling pipeline."""
    result = _extract_with_trafilatura(html, url)
    engine = "trafilatura"
    if result is None:
        result = _extract_with_scrapling(html, url)
        engine = "scrapling"
    if result is None:
        return {"engine": "none", "len": 0, "score": 0}
    q = _score_quality(result["body"], html)
    return {
        "engine": result.get("engine", engine),
        "len": len(result["body"]),
        "score": q["total"],
    }


async def _crawl4ai_extract(url: str) -> dict:
    """Run Crawl4AI extraction."""
    try:
        from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
        browser_cfg = BrowserConfig(headless=True, verbose=False)
        crawler = AsyncWebCrawler(config=browser_cfg)
        await crawler.start()
        try:
            run_cfg = CrawlerRunConfig(cache_mode=CacheMode.BYPASS)
            result = await crawler.arun(url=url, config=run_cfg)
            if result.success:
                md = result.markdown or ""
                q = _score_quality(md, "")
                return {
                    "engine": "crawl4ai",
                    "len": len(md),
                    "score": q["total"],
                }
            return {"engine": "crawl4ai-fail", "len": 0, "score": 0, "error": result.error_message}
        finally:
            await crawler.close()
    except Exception as e:
        return {"engine": "crawl4ai-error", "len": 0, "score": 0, "error": str(e)}


async def main():
    print("=" * 70)
    print("  Crawl4AI vs Self-Built Pipeline Comparison")
    print("=" * 70)

    import httpx
    limits = httpx.Limits(max_connections=5, max_keepalive_connections=5)
    client = httpx.Client(http2=True, limits=limits, timeout=30)

    results = []
    for url, name in TEST_URLS:
        print(f"\n--- {name} ---")
        print(f"URL: {url}")

        # Fetch HTML
        try:
            resp = client.get(url, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True)
            html = resp.text
        except Exception as e:
            print(f"  Fetch failed: {e}")
            continue

        # Current pipeline
        start = time.time()
        cur = _current_pipeline(html, url)
        cur["time"] = round(time.time() - start, 2)
        print(f"  Current: {cur['engine']} | {cur['len']} chars | Q={cur['score']:.0f} | {cur['time']}s")

        # Crawl4AI
        start = time.time()
        c4 = await _crawl4ai_extract(url)
        c4["time"] = round(time.time() - start, 2)
        print(f"  Crawl4AI: {c4['engine']} | {c4['len']} chars | Q={c4['score']:.0f} | {c4['time']}s")

        if "error" in c4:
            print(f"  Crawl4AI error: {c4['error']}")

        results.append({
            "name": name,
            "url": url,
            "current": cur,
            "crawl4ai": c4,
        })

    client.close()

    # Summary
    print("\n" + "=" * 70)
    print("  SUMMARY")
    print("=" * 70)
    print(f"{'Site':<20} {'Current':<25} {'Crawl4AI':<25} {'Winner'}")
    print("-" * 70)
    for r in results:
        cur_s = f"{r['current']['engine'][:12]} Q={r['current']['score']:.0f}"
        c4_s = f"Q={r['crawl4ai']['score']:.0f}"
        if r["crawl4ai"]["score"] > r["current"]["score"] + 5:
            winner = "Crawl4AI"
        elif r["current"]["score"] > r["crawl4ai"]["score"] + 5:
            winner = "Current"
        else:
            winner = "Tie"
        print(f"{r['name']:<20} {cur_s:<25} {c4_s:<25} {winner}")

    avg_cur = sum(r["current"]["score"] for r in results) / len(results) if results else 0
    avg_c4 = sum(r["crawl4ai"]["score"] for r in results) / len(results) if results else 0
    print(f"\nAverage quality — Current: {avg_cur:.1f}, Crawl4AI: {avg_c4:.1f}")
    if avg_c4 > avg_cur + 5:
        print("Verdict: Crawl4AI wins — consider replacing Scrapling layer")
    elif avg_cur > avg_c4 + 5:
        print("Verdict: Current pipeline wins — Crawl4AI not worth the dependency")
    else:
        print("Verdict: Tie — Crawl4AI is comparable, optional enhancement")


if __name__ == "__main__":
    asyncio.run(main())
