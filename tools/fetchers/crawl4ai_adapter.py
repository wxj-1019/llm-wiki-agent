#!/usr/bin/env python3
"""Crawl4AI adapter — optional replacement for the self-built extraction pipeline.

Implements the same interface as LLMExtractor so it can be dropped in as a
Layer-3 fallback or full replacement if Crawl4AI quality > self-built by 10%+.

Usage:
    from tools.fetchers.crawl4ai_adapter import Crawl4AIAdapter
    adapter = Crawl4AIAdapter(config)
    result = await adapter.extract(html, url=url, title=title)

Install:
    pip install crawl4ai
    playwright install chromium
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from tools.fetchers.llm_extractor import (
    Entity,
    ExtractionResult,
    LLMExtractionError,
    QualityAssessment,
)

try:
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
    CRAWL4AI_AVAILABLE = True
except ImportError:
    CRAWL4AI_AVAILABLE = False


class Crawl4AIAdapter:
    """Drop-in adapter wrapping Crawl4AI with the LLMExtractor interface."""

    def __init__(self, config: dict[str, Any] | None = None):
        if not CRAWL4AI_AVAILABLE:
            raise LLMExtractionError(
                "crawl4ai not installed. Run: pip install crawl4ai && playwright install chromium"
            )
        self._cfg = config or {}
        self._browser_cfg = BrowserConfig(
            headless=True,
            verbose=False,
        )
        self._crawler: AsyncWebCrawler | None = None

    async def _ensure_crawler(self) -> AsyncWebCrawler:
        if self._crawler is None:
            self._crawler = AsyncWebCrawler(config=self._browser_cfg)
            await self._crawler.start()
        return self._crawler

    async def extract(self, html: str = "", url: str = "", title: str = "") -> ExtractionResult:
        """Extract content via Crawl4AI. HTML is ignored — Crawl4AI fetches itself."""
        if not url:
            return ExtractionResult(
                content="", summary="", extractor="crawl4ai",
                quality=QualityAssessment(score=0, is_error=True, issues=["URL required"]),
            )

        crawler = await self._ensure_crawler()
        run_cfg = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            markdown_generator=None,  # Use default
        )

        result = await crawler.arun(url=url, config=run_cfg)

        if not result.success:
            return ExtractionResult(
                content="", summary="", extractor="crawl4ai",
                quality=QualityAssessment(
                    score=0, is_error=True,
                    issues=[result.error_message or "Crawl4AI failed"],
                ),
            )

        md = result.markdown or ""
        if not md or len(md.strip()) < 100:
            return ExtractionResult(
                content="", summary="", extractor="crawl4ai",
                quality=QualityAssessment(
                    score=20, is_navigation=True,
                    issues=["Crawl4AI returned low-quality content"],
                ),
            )

        # Simple heuristic quality score
        score = min(100, len(md) // 50)
        has_structure = "#" in md
        if has_structure:
            score = min(100, score + 15)

        return ExtractionResult(
            content=md.strip(),
            summary=result.fit_markdown or "",  # Crawl4AI fit-to-width markdown
            entities=[],  # Entity extraction delegated to LLMExtractor if needed
            extractor="crawl4ai",
            quality=QualityAssessment(score=score, is_article=True, issues=[]),
            metadata={"url": url, "title": title or result.metadata.get("title", "")},
        )

    async def batch_scrape(
        self,
        items: list[dict[str, str]],
        max_concurrent: int = 3,
    ) -> list[ExtractionResult]:
        """Batch scrape URLs via Crawl4AI."""
        import asyncio
        semaphore = asyncio.Semaphore(max_concurrent)

        async def _one(item: dict[str, str]) -> ExtractionResult:
            async with semaphore:
                return await self.extract(url=item.get("url", ""), title=item.get("title", ""))

        return await asyncio.gather(*(_one(item) for item in items))

    async def close(self) -> None:
        if self._crawler:
            await self._crawler.close()
            self._crawler = None
