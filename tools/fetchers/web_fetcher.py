#!/usr/bin/env python3
"""Fetch arbitrary web pages, extract article content, and save as markdown.

Three-layer extraction cascade:
  Layer 1: trafilatura (fast, free, offline)
  Layer 2: LLM fast model (haiku) — quick cleanup for low-quality results
  Layer 3: LLM deep model (sonnet) — deep extraction from raw HTML

Optional Playwright browser rendering for JS-heavy pages.

Usage:
    python tools/fetchers/web_fetcher.py --config config/web_sources.yaml
    python tools/fetchers/web_fetcher.py --url "https://example.com/article"
    python tools/fetchers/web_fetcher.py --config config/web_sources.yaml --max-urls 3 --dry-run
    python tools/fetchers/web_fetcher.py --url "https://example.com" --browser

Dependencies:
    pip install trafilatura httpx
    # Optional: playwright (for JS rendering), litellm (for LLM extraction)
"""
from __future__ import annotations

import argparse
import asyncio
import codecs
import json
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.robotparser
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from tools.fetchers._common import (
    REPO_ROOT,
    content_fingerprint,
    load_config,
    load_state,
    log_failed,
    safe_write_path,
    save_state,
)

OUT_DIR = REPO_ROOT / "raw-inbox" / "fetched" / "web"
REPORT_PATH = REPO_ROOT / "raw-inbox" / "web_report.json"

_USER_AGENT = "llm-wiki-agent/1.0 (research article crawler; respects robots.txt)"

_UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
]

_QUALITY_SKIP_THRESHOLD = 70
_QUALITY_LLM_FAST_THRESHOLD = 40


class DomainStrategy:
    """Learn and apply per-domain extraction strategies."""

    def __init__(self, state_file: Path | None = None):
        self._state_file = state_file or (REPO_ROOT / "state" / "domain_strategy.json")
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state = self._load()

    def get_fast_path(self, domain: str) -> str | None:
        info = self._state.get(domain, {})
        if info.get("fast_path") and info.get("best_engine"):
            return info["best_engine"]
        return None

    def record_result(self, domain: str, engine: str, success: bool, quality: float = 0.0):
        if domain not in self._state:
            self._state[domain] = {
                "best_engine": engine, "success_count": 0, "failure_count": 0,
                "avg_quality": 0.0, "fast_path": False,
                "consecutive_successes": 0, "last_updated": "",
            }
        info = self._state[domain]
        info["last_updated"] = datetime.now().strftime("%Y-%m-%d")
        if success:
            info["success_count"] = info.get("success_count", 0) + 1
            info["consecutive_successes"] = info.get("consecutive_successes", 0) + 1
            n = info["success_count"]
            old_avg = info.get("avg_quality", 0.0)
            info["avg_quality"] = round(old_avg + (quality - old_avg) / n, 1)
            if info["consecutive_successes"] >= 5 and not info.get("fast_path"):
                info["fast_path"] = True
                info["best_engine"] = engine
        else:
            info["failure_count"] = info.get("failure_count", 0) + 1
            info["consecutive_successes"] = 0
            if info.get("fast_path"):
                info["fast_path"] = False
        self._save()

    def should_skip_engine(self, domain: str, engine: str) -> bool:
        info = self._state.get(domain, {})
        if info.get("fast_path") and info.get("best_engine") != engine:
            return True
        return False

    def get_stats(self) -> dict:
        total = len(self._state)
        fast_path = sum(1 for v in self._state.values() if v.get("fast_path"))
        return {"total_domains": total, "fast_path_domains": fast_path}

    def _load(self) -> dict:
        if self._state_file.exists():
            try:
                return json.loads(self._state_file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        return {}

    def _save(self):
        tmp = self._state_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._state, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self._state_file)


# ── Site-specific CSS selectors (loaded from scraper_config.yaml) ────────────
_SITE_SELECTOR_CACHE: dict[str, list[str]] | None = None


def _load_site_selectors() -> dict[str, list[str]]:
    """Load site-specific CSS selectors from scraper_config.yaml."""
    global _SITE_SELECTOR_CACHE
    if _SITE_SELECTOR_CACHE is not None:
        return _SITE_SELECTOR_CACHE
    cfg_path = REPO_ROOT / "config" / "scraper_config.yaml"
    selectors: dict[str, list[str]] = {}
    if cfg_path.exists():
        try:
            import yaml
            with open(cfg_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            selectors = data.get("scraper", {}).get("site_selectors", {})
        except Exception:
            pass
    _SITE_SELECTOR_CACHE = selectors
    return selectors


def _get_site_selectors(url: str) -> list[str]:
    """Return CSS selectors for a given URL based on domain matching."""
    selectors = _load_site_selectors()
    if not selectors:
        return []
    parsed = urllib.parse.urlparse(url)
    hostname = parsed.hostname or ""
    # Try exact match, then suffix match
    for domain, sels in selectors.items():
        if domain in hostname:
            return sels
    return []

# ── Optional engines ─────────────────────────────────────────────────────────
try:
    import trafilatura
    TRAFILATURA_AVAILABLE = True
except ImportError:
    TRAFILATURA_AVAILABLE = False

try:
    from markitdown import MarkItDown
    _MD_INSTANCE = MarkItDown()
    MARKITDOWN_AVAILABLE = True
except Exception:
    MARKITDOWN_AVAILABLE = False
    _MD_INSTANCE = None

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

try:
    from tools.fetchers.llm_extractor import LLMExtractor
    LLM_AVAILABLE = True
except ImportError:
    LLM_AVAILABLE = False

try:
    from scrapling import Selector
    SCRAPLING_AVAILABLE = True
except ImportError:
    SCRAPLING_AVAILABLE = False


def _pick_ua(rotate: bool = True) -> str:
    if rotate:
        return random.choice(_UA_POOL)
    return _USER_AGENT


# ── Playwright browser pool ──────────────────────────────────────────────────
class _BrowserPool:
    def __init__(self, max_instances: int = 3, timeout: int = 30):
        self._max = max_instances
        self._timeout = timeout
        self._pw = None
        self._browser = None
        self._sem = asyncio.Semaphore(max_instances)

    async def start(self):
        if not PLAYWRIGHT_AVAILABLE:
            return
        self._pw = await async_playwright().start()
        try:
            self._browser = await self._pw.chromium.launch(headless=True)
        except Exception as e:
            print(f"  [WARN] Playwright browser launch failed: {e}", file=sys.stderr)
            self._browser = None

    async def stop(self):
        if self._browser:
            await self._browser.close()
        if self._pw:
            await self._pw.stop()
        self._browser = None
        self._pw = None

    @property
    def available(self) -> bool:
        return self._browser is not None

    async def render(self, url: str, wait_ms: int = 3000) -> str | None:
        if not self._browser:
            return None
        async with self._sem:
            page = None
            try:
                page = await self._browser.new_page()
                await page.goto(url, timeout=self._timeout * 1000, wait_until="domcontentloaded")
                await page.wait_for_timeout(wait_ms)
                html = await page.content()
                return html
            except Exception as e:
                print(f"  [WARN] Playwright render failed: {e}", file=sys.stderr)
                return None
            finally:
                if page:
                    await page.close()


# ── robots.txt with TTL ──────────────────────────────────────────────────────
@dataclass
class _RobotsEntry:
    parser: urllib.robotparser.RobotFileParser
    fetched_at: float

_ROBOTS_CACHE: dict[str, _RobotsEntry] = {}
_ROBOTS_TTL = 3600


def _check_robots_txt(url: str, user_agent: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        now = time.time()
        entry = _ROBOTS_CACHE.get(robots_url)
        if entry is None or (now - entry.fetched_at) > _ROBOTS_TTL:
            rp = urllib.robotparser.RobotFileParser()
            rp.set_url(robots_url)
            rp.read()
            entry = _RobotsEntry(parser=rp, fetched_at=now)
            _ROBOTS_CACHE[robots_url] = entry
        return entry.parser.can_fetch(user_agent, url)
    except Exception:
        return True


# ── Encoding detection ───────────────────────────────────────────────────────
def _detect_charset(data: bytes, headers: dict[str, str]) -> str:
    ct = headers.get("content-type", "")
    m = re.search(r'charset=([^\s;]+)', ct, re.IGNORECASE)
    if m:
        charset = m.group(1).strip('"\'').lower()
        try:
            codecs.lookup(charset)
            return charset
        except LookupError:
            pass

    head = data[:8192]
    text_head = head.decode("ascii", errors="ignore")
    m = re.search(r'<meta[^>]+charset=["\']?([^"\'>\s]+)', text_head, re.IGNORECASE)
    if m:
        charset = m.group(1).lower()
        try:
            codecs.lookup(charset)
            return charset
        except LookupError:
            pass

    if data.startswith(b'<?xml'):
        m = re.search(r'encoding=["\']?([^"\'>\s]+)', text_head)
        if m:
            try:
                codecs.lookup(m.group(1))
                return m.group(1)
            except LookupError:
                pass

    for mod_name in ("charset_normalizer", "chardet"):
        try:
            mod = __import__(mod_name)
            result = mod.detect(data)
            if result and result.get("encoding"):
                enc = result["encoding"]
                try:
                    codecs.lookup(enc)
                    return enc
                except LookupError:
                    pass
        except ImportError:
            continue

    return "utf-8"


# ── HTTP with retry + UA rotation ────────────────────────────────────────────
class FetchError(Exception):
    def __init__(self, msg: str, category: str, retryable: bool = False):
        super().__init__(msg)
        self.category = category
        self.retryable = retryable


def _fetch_html(
    url: str,
    client: httpx.Client,
    timeout: int,
    user_agent: str,
    max_retries: int = 3,
    etag: str | None = None,
    last_modified: str | None = None,
    rotate_ua: bool = True,
) -> tuple[str | None, dict[str, str]]:
    if not _check_robots_txt(url, user_agent):
        print(f"  [SKIP] robots.txt disallows: {url}")
        return None, {}

    ua = _pick_ua(rotate_ua)
    headers = {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5,zh-CN;q=0.3",
        "Accept-Encoding": "gzip, deflate, identity",
    }
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified

    out_headers: dict[str, str] = {}

    for attempt in range(1, max_retries + 1):
        try:
            resp = client.get(url, headers=headers, timeout=timeout, follow_redirects=True)

            if resp.status_code == 304:
                print("  [SKIP] Not modified (304)")
                return None, {"not_modified": "true"}

            resp.raise_for_status()

            out_headers["etag"] = resp.headers.get("etag", "")
            out_headers["last_modified"] = resp.headers.get("last-modified", "")

            data = resp.content
            charset = _detect_charset(data, dict(resp.headers))
            return data.decode(charset, errors="replace"), out_headers

        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            retryable = status in (429, 500, 502, 503, 504)
            if retryable and attempt < max_retries:
                sleep_sec = 2 ** attempt + random.uniform(0, 1)
                print(f"  [RETRY] HTTP {status} (attempt {attempt}/{max_retries}), wait {sleep_sec:.1f}s")
                time.sleep(sleep_sec)
                continue
            print(f"  [FAIL] HTTP {status} for {url}")
            return None, {}

        except (httpx.TimeoutException, httpx.ConnectError, httpx.NetworkError) as e:
            if attempt < max_retries:
                sleep_sec = 2 ** attempt + random.uniform(0, 1)
                print(f"  [RETRY] Network error (attempt {attempt}/{max_retries}), wait {sleep_sec:.1f}s")
                time.sleep(sleep_sec)
                continue
            print(f"  [FAIL] Network error for {url}: {e}")
            return None, {}

        except Exception as e:
            print(f"  [FAIL] Unexpected error for {url}: {e}")
            return None, {}

    return None, {}


# ── Link extraction (for deep crawl) ─────────────────────────────────────────
def _normalize_url(url: str, base_url: str) -> str | None:
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme and parsed.scheme not in ("http", "https"):
            return None
        full = urllib.parse.urljoin(base_url, url)
        p = urllib.parse.urlparse(full)
        return urllib.parse.urlunparse(p._replace(fragment=""))
    except Exception:
        return None


def _should_follow(url: str, base_domain: str, rules: dict[str, Any]) -> bool:
    try:
        parsed = urllib.parse.urlparse(url)
        if rules.get("stay_in_domain", True):
            if parsed.netloc != base_domain:
                return False
        includes = rules.get("include_patterns", [])
        if includes:
            if not any(re.search(pat, url) for pat in includes):
                return False
        excludes = rules.get("exclude_patterns", [])
        for pat in excludes:
            if re.search(pat, url):
                return False
        return True
    except Exception:
        return False


def _extract_links(html: str, base_url: str) -> list[str]:
    links: list[str] = []
    seen: set[str] = set()
    for m in re.finditer(r'href=["\']([^"\'>\s]+)', html, re.IGNORECASE):
        raw = m.group(1)
        normalized = _normalize_url(raw, base_url)
        if normalized and normalized not in seen:
            seen.add(normalized)
            links.append(normalized)
    return links


# ── Layer 1: trafilatura ─────────────────────────────────────────────────────
def _extract_with_trafilatura(html: str, url: str) -> dict[str, Any] | None:
    if not TRAFILATURA_AVAILABLE:
        return None
    try:
        text = trafilatura.extract(
            html,
            url=url,
            output_format="markdown",
            include_comments=False,
            include_tables=True,
            favor_precision=False,
            deduplicate=True,
        )
        if not text or len(text.strip()) < 50:
            return None
        meta = trafilatura.extract_metadata(html, default_url=url)
        return {
            "body": text.strip(),
            "title": (meta.title if meta and meta.title else ""),
            "author": (meta.author if meta and meta.author else ""),
            "date": (meta.date if meta and meta.date else ""),
            "sitename": (meta.sitename if meta and meta.sitename else ""),
            "description": (meta.description if meta and meta.description else ""),
            "engine": "trafilatura",
        }
    except Exception as e:
        print(f"  [WARN] Trafilatura extraction failed: {e}", file=sys.stderr)
        return None


# ── Layer 1 fallback: markitdown ─────────────────────────────────────────────
def _extract_with_markitdown(html: str) -> dict[str, Any] | None:
    if not MARKITDOWN_AVAILABLE or _MD_INSTANCE is None:
        return None
    try:
        result = _MD_INSTANCE.convert_string(html)
        text = result.text_content if result else ""
        if not text or len(text.strip()) < 50:
            return None
        return {
            "body": text.strip(),
            "title": "",
            "author": "",
            "date": "",
            "sitename": "",
            "description": "",
            "engine": "markitdown",
        }
    except Exception as e:
        print(f"  [WARN] markitdown extraction failed: {e}", file=sys.stderr)
        return None


# ── Layer 2: Scrapling adaptive extraction ───────────────────────────────────
def _extract_with_scrapling(html: str, url: str) -> dict[str, Any] | None:
    """Adaptive extraction via Scrapling Selector. Tries site-specific selectors first."""
    if not SCRAPLING_AVAILABLE:
        return None
    try:
        s = Selector(html)
        best_text = ""
        best_sel = ""

        # Phase 6: Try site-specific selectors first
        site_selectors = _get_site_selectors(url)
        if site_selectors:
            for sel in site_selectors:
                els = s.css(sel)
                if els:
                    text = els[0].get_all_text()
                    if len(text) > len(best_text):
                        best_text = text
                        best_sel = sel
            if best_text:
                print(f"  [INFO] Site-specific selector matched: {best_sel}")

        # Fallback: generic content selectors
        if len(best_text) < 100:
            generic_selectors = ["article", "main", ".content", "#content", ".post", ".article", ".entry", ".detail"]
            for sel in generic_selectors:
                els = s.css(sel)
                if els:
                    text = els[0].get_all_text()
                    if len(text) > len(best_text):
                        best_text = text
                        best_sel = sel

        # Fallback: body minus nav/footer
        if len(best_text) < 100:
            body = s.css("body")
            if body:
                raw = body[0].get_all_text()
                # Heuristic: remove short lines that look like nav/footer
                lines = [ln for ln in raw.splitlines() if len(ln.strip()) > 3]
                best_text = "\n".join(lines)
                best_sel = "body"

        if not best_text or len(best_text.strip()) < 100:
            return None

        # Extract title
        title = ""
        h1 = s.css("h1")
        if h1:
            title = h1[0].get_all_text()
        return {
            "body": best_text.strip(),
            "title": title,
            "author": "",
            "date": "",
            "sitename": "",
            "description": "",
            "engine": f"scrapling({best_sel or 'body'})",
        }
    except Exception as e:
        print(f"  [WARN] Scrapling extraction failed: {e}", file=sys.stderr)
        return None


# ── Layer 3: LLM extraction ──────────────────────────────────────────────────
async def _extract_with_llm(
    html: str, url: str, use_deep: bool = False,
) -> dict[str, Any] | None:
    if not LLM_AVAILABLE:
        return None
    try:
        from tools.fetchers.llm_extractor import LLMExtractor
        scraper_cfg_path = REPO_ROOT / "config" / "scraper_config.yaml"
        import yaml
        cfg: dict[str, Any] = {}
        if scraper_cfg_path.exists():
            with open(scraper_cfg_path, "r", encoding="utf-8") as f:
                cfg = yaml.safe_load(f) or {}

        if use_deep:
            model = os.getenv("LLM_MODEL", "deepseek/deepseek-chat")
            cfg.setdefault("scraper", {}).setdefault("extraction", {})["model"] = model
        else:
            cfg.setdefault("scraper", {}).setdefault("extraction", {})["model"] = (
                cfg.get("scraper", {}).get("extraction", {}).get("fallback_model", "deepseek/deepseek-chat")
            )

        extractor = LLMExtractor(cfg)
        result = await extractor.extract(html, url=url)

        if not result.content or len(result.content.strip()) < 50:
            return None

        engine_label = "llm-deep" if use_deep else "llm-fast"
        return {
            "body": result.content.strip(),
            "title": result.metadata.get("title", ""),
            "author": "",
            "date": "",
            "sitename": "",
            "description": result.summary or "",
            "engine": engine_label,
        }
    except Exception as e:
        print(f"  [WARN] LLM extraction failed: {e}", file=sys.stderr)
        return None


# ── Quality scoring ──────────────────────────────────────────────────────────
def _score_quality(body: str, html: str = "") -> dict[str, Any]:
    scores: dict[str, float] = {}
    length = len(body)
    scores["length"] = min(100.0, length / 50.0) if length < 2000 else (100.0 if length < 15000 else max(0, 100 - (length - 15000) / 500))
    paragraphs = [p.strip() for p in body.split("\n\n") if p.strip()]
    scores["structure"] = min(100.0, len(paragraphs) * 5.0)
    link_count = len(re.findall(r'\[.*?\]\(.*?\)', body))
    link_density = link_count / max(len(paragraphs), 1)
    scores["link_density"] = max(0, 100 - link_density * 20)
    code_blocks = body.count("```")
    scores["richness"] = min(100.0, 20 + code_blocks * 10)

    if html:
        if re.search(r'<article\b', html, re.IGNORECASE):
            scores["structure"] = min(100.0, scores["structure"] + 15)
        if re.search(r'application/ld\+json.*?"@type".*?"Article', html, re.IGNORECASE | re.DOTALL):
            scores["richness"] = min(100.0, scores["richness"] + 25)
        nav_ratio = len(re.findall(r'<nav\b', html, re.IGNORECASE)) / max(len(html) / 10000, 1)
        if nav_ratio > 0.3:
            scores["structure"] = max(0, scores["structure"] - 20)

    total = (
        scores["length"] * 0.35 +
        scores["structure"] * 0.25 +
        scores["link_density"] * 0.20 +
        scores["richness"] * 0.20
    )
    scores["total"] = round(total, 1)
    return scores


# ── Three-layer cascade extraction ───────────────────────────────────────────
async def _extract_content_cascade(
    html: str, url: str, fallback: bool, use_llm: bool = True,
) -> dict[str, Any] | None:
    """Three-layer extraction cascade per the optimization plan.

    Layer 1: trafilatura (fast, free, offline)
      - quality >= 70 → direct pass
      - quality 40-69 → Layer 2
      - quality < 40 → Layer 2 then Layer 3
    Layer 2: Scrapling adaptive extraction (free, offline, site-change resilient)
      - success → mark extractor: scrapling
      - failure → fallback to LLM
    Layer 3: LLM extraction (sonnet/haiku) — deep extraction from raw HTML
    """
    result = _extract_with_trafilatura(html, url)

    if result is None:
        if fallback:
            print(f"  [INFO] Layer 1 failed, trying markitdown for {url}")
            result = _extract_with_markitdown(html)

        if result is None:
            if use_llm and LLM_AVAILABLE:
                print(f"  [INFO] Layer 1 miss, trying LLM deep extraction for {url}")
                llm_result = await _extract_with_llm(html, url, use_deep=True)
                if llm_result:
                    return llm_result
            return None

    # Quality scoring (always run)
    q = _score_quality(result["body"], html)
    result["_quality"] = q

    if q["total"] >= _QUALITY_SKIP_THRESHOLD:
        return result

    # Layer 2: Scrapling adaptive extraction (free, offline, always try)
    if SCRAPLING_AVAILABLE:
        print(f"  [INFO] Quality={q['total']:.0f}, trying Scrapling adaptive extraction for {url}")
        scrapling_result = _extract_with_scrapling(html, url)
        if scrapling_result:
            sq = _score_quality(scrapling_result["body"], html)
            scrapling_result["_quality"] = sq
            print(f"  [INFO] Scrapling quality={sq['total']:.0f}")
            if sq["total"] >= _QUALITY_LLM_FAST_THRESHOLD:
                return scrapling_result
            # Scrapling succeeded but quality still low → keep for LLM fallback
            result = scrapling_result
            q = sq  # Update quality for downstream decisions

    # Layer 3: LLM extraction (only if enabled and available)
    if not use_llm or not LLM_AVAILABLE:
        print(f"  [INFO] LLM unavailable, returning best effort (quality={q['total']:.0f})")
        return result

    if q["total"] >= _QUALITY_LLM_FAST_THRESHOLD:
        print(f"  [INFO] Quality={q['total']:.0f}, trying LLM fast cleanup for {url}")
        llm_result = await _extract_with_llm(html, url, use_deep=False)
        if llm_result:
            return llm_result
        return result

    print(f"  [INFO] Quality={q['total']:.0f}, trying LLM deep extraction for {url}")
    llm_result = await _extract_with_llm(html, url, use_deep=True)
    if llm_result:
        return llm_result
    return result


def _extract_content(
    html: str, url: str, fallback: bool
) -> dict[str, Any] | None:
    result = _extract_with_trafilatura(html, url)
    if result:
        return result
    if fallback:
        print(f"  [INFO] Falling back to markitdown for {url}")
        result = _extract_with_markitdown(html)
        if result:
            return result
    return None


# ── Output ───────────────────────────────────────────────────────────────────
def _write_entry(
    url: str,
    name: str,
    tags: list[str],
    extracted: dict[str, Any],
    dry_run: bool,
    headers: dict[str, str],
    content_fp: str,
    state: dict[str, Any],
) -> Path | None:
    if url in state.get("processed_urls", {}) and not dry_run:
        return None

    title = extracted.get("title") or name or "Untitled"
    body = extracted.get("body", "")
    if len(body) < 50:
        print(f"  [SKIP] Content too short, skipping: {url}")
        return None

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = safe_write_path(OUT_DIR, title)

    fm: dict[str, str] = {
        "title": title.replace('"', '\\"'),
        "source_url": url,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source_type": "web",
        "name": name or title,
        "tags": ", ".join(tags),
    }
    if extracted.get("author"):
        fm["author"] = extracted["author"]
    if extracted.get("date"):
        fm["published"] = extracted["date"]
    if extracted.get("sitename"):
        fm["sitename"] = extracted["sitename"]
    if extracted.get("description"):
        fm["description"] = extracted["description"]
    if extracted.get("engine"):
        fm["extractor"] = extracted["engine"]

    fm_lines = "\n".join(f'{k}: "{v}"' for k, v in fm.items())
    content = f"""---
{fm_lines}
---

## Summary

{body}
"""
    if not dry_run:
        out_path.write_text(content, encoding="utf-8")
        state.setdefault("processed_urls", {})[url] = str(out_path.relative_to(REPO_ROOT).as_posix())
        state.setdefault("url_meta", {})[url] = {
            "etag": headers.get("etag", ""),
            "last_modified": headers.get("last_modified", ""),
            "content_fp": content_fp,
        }
        state.setdefault("content_hashes", {})[content_fp] = url
    return out_path


# ── Main flow ────────────────────────────────────────────────────────────────
async def _async_run(
    config_path: Path | None,
    single_url: str | None,
    max_urls: int | None,
    dry_run: bool,
    write_report: bool,
    use_browser: bool,
    use_llm: bool,
) -> int:
    if not TRAFILATURA_AVAILABLE:
        print("ERROR: trafilatura is not installed.", file=sys.stderr)
        print("Install: pip install trafilatura", file=sys.stderr)
        return 1

    entries: list[dict[str, Any]] = []
    settings: dict[str, Any] = {}
    if single_url:
        entries.append({"url": single_url, "name": "", "tags": []})
    elif config_path:
        cfg = load_config(config_path)
        entries = cfg.get("urls", [])
        settings = cfg.get("settings", {})
    else:
        print("ERROR: Provide --config or --url", file=sys.stderr)
        return 1

    if not entries:
        print("No URLs configured.", file=sys.stderr)
        return 1

    if max_urls:
        entries = entries[:max_urls]

    timeout = settings.get("timeout", 30)
    user_agent = settings.get("user_agent", _USER_AGENT)
    fallback = settings.get("fallback_to_markitdown", True)
    delay = settings.get("request_delay", 1.0)
    min_length = settings.get("content_min_length", 200)
    max_depth = settings.get("max_depth", 0)
    max_pages_per_source = settings.get("max_pages_per_source", 10)
    rotate_ua = settings.get("rotate_ua", True)
    crawl_rules = {
        "stay_in_domain": settings.get("stay_in_domain", True),
        "include_patterns": settings.get("include_patterns", []),
        "exclude_patterns": settings.get("exclude_patterns", []),
    }

    if use_browser and settings.get("browser", {}).get("enabled", False):
        use_browser = True
    elif use_browser and not settings.get("browser"):
        pass
    else:
        use_browser = use_browser or settings.get("use_browser", False)

    browser_pool: _BrowserPool | None = None
    if use_browser and PLAYWRIGHT_AVAILABLE:
        browser_pool = _BrowserPool(
            max_instances=settings.get("browser", {}).get("max_instances", 3),
            timeout=timeout,
        )
        await browser_pool.start()
        if browser_pool.available:
            print("Playwright browser pool started")
        else:
            print("Playwright not available, falling back to httpx only")
            browser_pool = None
    elif use_browser and not PLAYWRIGHT_AVAILABLE:
        print("Playwright not installed, falling back to httpx only", file=sys.stderr)

    state = load_state()
    total_success = 0
    total_skipped = 0
    total_failed = 0

    visited_this_run: set[str] = set()

    stats: dict[str, Any] = {
        "urls": [],
        "engines": {},
        "quality_scores": [],
        "start_time": datetime.now(timezone.utc).isoformat(),
    }

    async def _get_html(url: str, client: httpx.Client) -> tuple[str | None, dict[str, str]]:
        url_meta = state.get("url_meta", {}).get(url, {})
        etag = url_meta.get("etag", "")
        last_modified = url_meta.get("last_modified", "")

        if use_llm or browser_pool:
            if browser_pool and browser_pool.available:
                html = await browser_pool.render(url)
                if html:
                    return html, {"etag": "", "last_modified": ""}

        return _fetch_html(
            url, client, timeout, user_agent,
            etag=etag, last_modified=last_modified, rotate_ua=rotate_ua,
        )

    async def _process_one(
        url: str, name: str, tags: list[str], depth: int, base_domain: str, client: httpx.Client
    ) -> tuple[int, int, int, str | None]:
        nonlocal total_success, total_skipped, total_failed

        if not url or url in visited_this_run:
            return 0, 1, 0, None
        visited_this_run.add(url)

        print(f"  [depth={depth}] {url}")

        if url in state.get("processed_urls", {}) and not dry_run:
            url_meta = state.get("url_meta", {}).get(url, {})
            if not url_meta.get("etag") and not url_meta.get("last_modified"):
                print("    [SKIP] Already processed")
                return 0, 1, 0, None

        html, headers = await _get_html(url, client)
        if headers.get("not_modified"):
            print("    [SKIP] Not modified since last fetch")
            return 0, 1, 0, None
        if html is None:
            log_failed(url, "fetch")
            return 0, 0, 1, None

        extracted = await _extract_content_cascade(html, url, fallback, use_llm=use_llm)

        if extracted is None:
            print("    [FAIL] Extraction failed")
            log_failed(url, "extraction")
            return 0, 0, 1, None

        if len(extracted.get("body", "")) < min_length:
            print(f"    [SKIP] Content too short ({len(extracted.get('body', ''))} chars)")
            return 0, 1, 0, None

        fp = content_fingerprint(extracted["body"])
        seen_hashes = state.get("content_hashes", {})
        if not dry_run and fp in seen_hashes and seen_hashes[fp] != url:
            print(f"    [SKIP] Duplicate content (same as {seen_hashes[fp]})")
            return 0, 1, 0, None

        q = _score_quality(extracted["body"], html)
        grade = "A" if q["total"] >= 80 else "B" if q["total"] >= 60 else "C" if q["total"] >= 40 else "D"
        extracted["_quality"] = q
        extracted["_quality_grade"] = grade

        engine = extracted.get("engine", "unknown")
        stats["engines"][engine] = stats["engines"].get(engine, 0) + 1
        stats["quality_scores"].append(q["total"])
        stats["urls"].append({"url": url, "grade": grade, "score": q["total"], "engine": engine})

        out_path = _write_entry(url, name, tags, extracted, dry_run, headers, fp, state)
        if out_path:
            print(f"    [OK] Saved to {out_path.name} ({engine}) [Q={grade}:{q['total']}]")
            return 1, 0, 0, html
        else:
            if dry_run:
                print(f"    [DRY] Would save [Q={grade}:{q['total']}]")
                return 1, 0, 0, html
            else:
                print("    [FAIL] Write failed")
                return 0, 0, 1, None

    limits = httpx.Limits(max_connections=20, max_keepalive_connections=10)
    with httpx.Client(http2=True, limits=limits) as client:
        for entry_idx, entry in enumerate(entries, 1):
            seed_url = entry.get("url", "")
            seed_name = entry.get("name", "")
            seed_tags = entry.get("tags", [])
            if not seed_url:
                continue

            print(f"\n[Source {entry_idx}/{len(entries)}] {seed_name or seed_url}")

            base_domain = urllib.parse.urlparse(seed_url).netloc
            source_success = 0

            queue: list[tuple[str, str, list[str], int]] = [(seed_url, seed_name, seed_tags, 0)]
            successful_pages = 0
            attempts = 0
            max_attempts = max_pages_per_source * 5

            while queue and successful_pages < max_pages_per_source and attempts < max_attempts:
                url, name, tags, depth = queue.pop(0)
                s, sk, f, html = await _process_one(url, name, tags, depth, base_domain, client)
                attempts += 1
                total_success += s
                total_skipped += sk
                total_failed += f
                if s > 0:
                    source_success += 1
                    successful_pages += 1

                if s > 0 and depth < max_depth and html:
                    links = _extract_links(html, url)
                    for link in links:
                        if link in visited_this_run:
                            continue
                        if not _should_follow(link, base_domain, crawl_rules):
                            continue
                        if len(queue) < max_pages_per_source * 10:
                            queue.append((link, "", seed_tags, depth + 1))

                if delay > 0:
                    jitter = random.uniform(0, delay * 0.3)
                    time.sleep(delay + jitter)

            print(f"  Source done: {source_success} saved, {attempts} scanned")

    if browser_pool:
        await browser_pool.stop()

    if not dry_run:
        state["last_runs"]["web"] = datetime.now(timezone.utc).isoformat()
        save_state(state)

    stats["end_time"] = datetime.now(timezone.utc).isoformat()
    stats["summary"] = {
        "success": total_success,
        "skipped": total_skipped,
        "failed": total_failed,
        "avg_quality": round(sum(stats["quality_scores"]) / len(stats["quality_scores"]), 1) if stats["quality_scores"] else 0,
    }
    print(f"\nDone. Success: {total_success}, Skipped: {total_skipped}, Failed: {total_failed}")
    if stats["quality_scores"]:
        avg_q = stats["summary"]["avg_quality"]
        print(f"Average quality score: {avg_q}/100")

    if write_report and not dry_run:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(json.dumps(stats, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Report saved to {REPORT_PATH}")

    return 0 if total_failed == 0 else (0 if total_success > 0 else 1)


def run(
    config_path: Path | None,
    single_url: str | None,
    max_urls: int | None,
    dry_run: bool,
    write_report: bool = False,
    use_browser: bool = False,
    use_llm: bool = False,
) -> int:
    return asyncio.run(_async_run(
        config_path, single_url, max_urls, dry_run, write_report, use_browser, use_llm,
    ))


# ── CLI ──────────────────────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch web articles for LLM Wiki Agent")
    parser.add_argument("--config", type=Path, help="Path to YAML/JSON config file")
    parser.add_argument("--url", help="Fetch a single URL directly")
    parser.add_argument("--max-urls", type=int, help="Limit number of URLs to fetch")
    parser.add_argument("--dry-run", action="store_true", help="Do not write files")
    parser.add_argument("--report", action="store_true", help="Write detailed JSON report")
    parser.add_argument("--browser", action="store_true", help="Use Playwright browser for JS rendering")
    parser.add_argument("--llm", action="store_true", help="Enable LLM extraction cascade")
    args = parser.parse_args()
    return run(args.config, args.url, args.max_urls, args.dry_run, args.report, args.browser, args.llm)


if __name__ == "__main__":
    sys.exit(main())
