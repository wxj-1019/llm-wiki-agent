#!/usr/bin/env python3
"""Fetch arbitrary web pages, extract article content, and save as markdown.

Usage:
    python tools/fetchers/web_fetcher.py --config config/web_sources.yaml
    python tools/fetchers/web_fetcher.py --url "https://example.com/article"
    python tools/fetchers/web_fetcher.py --config config/web_sources.yaml --max-urls 3 --dry-run

Dependencies:
    pip install trafilatura          (required, primary engine)
    # markitdown is optional fallback; already declared in pyproject.toml
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
import urllib.error
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Add vendor directory to path so trafilatura can be found when installed via --target
_REPO_ROOT = Path(__file__).resolve().parents[2]
_VENDOR_DIR = _REPO_ROOT / "vendor"
if str(_VENDOR_DIR) not in sys.path:
    sys.path.insert(0, str(_VENDOR_DIR))

# ── Request rotation ─────────────────────────────────────────────────────────
_USER_AGENTS = [
    "llm-wiki-agent/1.0 (research article crawler; respects robots.txt)",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
STATE_PATH = REPO_ROOT / "raw-inbox" / "state.json"
OUT_DIR = REPO_ROOT / "raw-inbox" / "fetched" / "web"
FAILED_LOG_PATH = REPO_ROOT / "raw-inbox" / "failed_urls.json"
REPORT_PATH = REPO_ROOT / "raw-inbox" / "web_report.json"

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


# ── State management ─────────────────────────────────────────────────────────
def _load_state() -> dict[str, Any]:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    return {"processed_urls": {}, "last_runs": {}}


def _save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


# ── robots.txt ───────────────────────────────────────────────────────────────
_ROBOTS_CACHE: dict[str, urllib.robotparser.RobotFileParser] = {}


def _check_robots_txt(url: str, user_agent: str) -> bool:
    """Return True if crawling is allowed."""
    try:
        parsed = urllib.parse.urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        if robots_url not in _ROBOTS_CACHE:
            rp = urllib.robotparser.RobotFileParser()
            rp.set_url(robots_url)
            rp.read()
            _ROBOTS_CACHE[robots_url] = rp
        return _ROBOTS_CACHE[robots_url].can_fetch(user_agent, url)
    except Exception:
        # If robots.txt cannot be fetched, allow by default
        return True


# ── HTTP with retry ──────────────────────────────────────────────────────────
class FetchError(Exception):
    """Base class for fetch errors with classification."""
    def __init__(self, msg: str, category: str, retryable: bool = False):
        super().__init__(msg)
        self.category = category
        self.retryable = retryable


def _fetch_html(
    url: str, timeout: int, user_agent: str, max_retries: int = 3,
    etag: str | None = None, last_modified: str | None = None,
) -> tuple[str | None, dict[str, str]]:
    """Fetch HTML. Returns (html_or_None, headers_dict).
    If server returns 304 Not Modified, html is None and headers indicate cache hit."""
    if not _check_robots_txt(url, user_agent):
        print(f"  [SKIP] robots.txt disallows: {url}")
        return None, {}

    headers_out: dict[str, str] = {}

    for attempt in range(1, max_retries + 1):
        ua = user_agent if attempt == 1 else random.choice(_USER_AGENTS)
        req_headers = {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "identity",
            "Connection": "keep-alive",
        }
        if etag:
            req_headers["If-None-Match"] = etag
        if last_modified:
            req_headers["If-Modified-Since"] = last_modified

        req = urllib.request.Request(url, headers=req_headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                headers_out["etag"] = resp.headers.get("ETag", "")
                headers_out["last_modified"] = resp.headers.get("Last-Modified", "")
                data = resp.read()
            # Success path
            charset = "utf-8"
            content_type = resp.headers.get("Content-Type", "")
            if "charset=" in content_type:
                charset = content_type.split("charset=")[1].split(";")[0].strip().lower()
            else:
                head = data[:4096].decode("utf-8", errors="ignore")
                m = re.search(r'<meta[^>]+charset=["\']?([^"\'>\s]+)', head, re.IGNORECASE)
                if m:
                    charset = m.group(1).lower()
            try:
                return data.decode(charset, errors="replace"), headers_out
            except Exception:
                return data.decode("utf-8", errors="replace"), headers_out

        except urllib.error.HTTPError as e:
            if e.code == 304:
                print(f"  [SKIP] Not modified (304)")
                return None, {"not_modified": "true"}
            retryable = e.code in (429, 500, 502, 503, 504)
            if retryable and attempt < max_retries:
                sleep_sec = 2 ** attempt + random.uniform(0, 1)
                print(f"  [RETRY] HTTP {e.code} (attempt {attempt}/{max_retries}), wait {sleep_sec:.1f}s")
                time.sleep(sleep_sec)
                continue
            print(f"  [FAIL] HTTP {e.code} for {url}")
            return None, {}

        except urllib.error.URLError as e:
            retryable = isinstance(e.reason, (TimeoutError, ConnectionError))
            if retryable and attempt < max_retries:
                sleep_sec = 2 ** attempt + random.uniform(0, 1)
                print(f"  [RETRY] Network error (attempt {attempt}/{max_retries}), wait {sleep_sec:.1f}s")
                time.sleep(sleep_sec)
                continue
            print(f"  [FAIL] Network error for {url}: {e.reason}")
            return None, {}

        except TimeoutError:
            if attempt < max_retries:
                sleep_sec = 2 ** attempt + random.uniform(0, 1)
                print(f"  [RETRY] Timeout (attempt {attempt}/{max_retries}), wait {sleep_sec:.1f}s")
                time.sleep(sleep_sec)
                continue
            print(f"  [FAIL] Timeout for {url}")
            return None, {}

        except Exception as e:
            print(f"  [FAIL] Unexpected error for {url}: {e}")
            return None, {}

    return None, {}


# ── Link extraction (for deep crawl) ─────────────────────────────────────────
def _normalize_url(url: str, base_url: str) -> str | None:
    """Resolve relative URLs and filter out non-HTTP schemes."""
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme and parsed.scheme not in ("http", "https"):
            return None
        full = urllib.parse.urljoin(base_url, url)
        # Remove fragment
        p = urllib.parse.urlparse(full)
        return urllib.parse.urlunparse(p._replace(fragment=""))
    except Exception:
        return None


def _should_follow(url: str, base_domain: str, rules: dict[str, Any]) -> bool:
    """Check if a discovered URL should be followed."""
    try:
        parsed = urllib.parse.urlparse(url)
        # Domain check
        if rules.get("stay_in_domain", True):
            if parsed.netloc != base_domain:
                return False
        # Include patterns
        includes = rules.get("include_patterns", [])
        if includes:
            if not any(re.search(pat, url) for pat in includes):
                return False
        # Exclude patterns
        excludes = rules.get("exclude_patterns", [])
        for pat in excludes:
            if re.search(pat, url):
                return False
        return True
    except Exception:
        return False


def _extract_links(html: str, base_url: str) -> list[str]:
    """Extract all href links from HTML."""
    links: list[str] = []
    seen: set[str] = set()
    for m in re.finditer(r'href=["\']([^"\'>\s]+)', html, re.IGNORECASE):
        raw = m.group(1)
        normalized = _normalize_url(raw, base_url)
        if normalized and normalized not in seen:
            seen.add(normalized)
            links.append(normalized)
    return links


# ── Content extraction ───────────────────────────────────────────────────────
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
            favor_precision=True,
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


def _score_quality(body: str) -> dict[str, Any]:
    """Score content quality on multiple dimensions. Returns 0-100 score + breakdown."""
    scores: dict[str, float] = {}
    # Length score: ideal 2000-10000 chars
    length = len(body)
    scores["length"] = min(100.0, length / 50.0) if length < 2000 else (100.0 if length < 15000 else max(0, 100 - (length - 15000) / 500))
    # Paragraph diversity: more paragraphs = better structure
    paragraphs = [p.strip() for p in body.split("\n\n") if p.strip()]
    scores["structure"] = min(100.0, len(paragraphs) * 5.0)
    # Link density: too many links = low quality
    link_count = len(re.findall(r'\[.*?\]\(.*?\)', body))
    link_density = link_count / max(len(paragraphs), 1)
    scores["link_density"] = max(0, 100 - link_density * 20)
    # Code blocks: technical content bonus
    code_blocks = body.count("```")
    scores["richness"] = min(100.0, 20 + code_blocks * 10)
    # Final weighted score
    total = (
        scores["length"] * 0.35 +
        scores["structure"] * 0.25 +
        scores["link_density"] * 0.20 +
        scores["richness"] * 0.20
    )
    scores["total"] = round(total, 1)
    return scores


def _log_failed(url: str, reason: str) -> None:
    """Append failed URL to persistent log."""
    try:
        entries: list[dict[str, Any]] = []
        if FAILED_LOG_PATH.exists():
            entries = json.loads(FAILED_LOG_PATH.read_text(encoding="utf-8"))
        entries.append({
            "url": url,
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        FAILED_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        FAILED_LOG_PATH.write_text(json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


def _content_fingerprint(text: str) -> str:
    """Simple content fingerprint for deduplication (first 1KB normalized)."""
    normalized = re.sub(r"\s+", " ", text.lower())[:1024].strip()
    import hashlib
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


def _extract_content(
    html: str, url: str, fallback: bool
) -> dict[str, Any] | None:
    # Primary: Trafilatura
    result = _extract_with_trafilatura(html, url)
    if result:
        return result
    # Fallback: markitdown
    if fallback:
        print(f"  [INFO] Falling back to markitdown for {url}")
        result = _extract_with_markitdown(html)
        if result:
            return result
    return None


# ── Output ───────────────────────────────────────────────────────────────────
def _slugify(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text.lower())
    text = re.sub(r"[-\s]+", "-", text).strip("-")
    return text[:80]


def _write_entry(
    url: str,
    name: str,
    tags: list[str],
    extracted: dict[str, Any],
    dry_run: bool,
    headers: dict[str, str],
    content_fp: str,
) -> Path | None:
    state = _load_state()
    if url in state.get("processed_urls", {}) and not dry_run:
        return None

    title = extracted.get("title") or name or "Untitled"
    body = extracted.get("body", "")
    if len(body) < 50:
        print(f"  [SKIP] Content too short, skipping: {url}")
        return None

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

    # Build YAML frontmatter
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
        state["processed_urls"][url] = str(out_path.relative_to(REPO_ROOT).as_posix())
        # Save ETag / Last-Modified for incremental updates
        if "url_meta" not in state:
            state["url_meta"] = {}
        state["url_meta"][url] = {
            "etag": headers.get("etag", ""),
            "last_modified": headers.get("last_modified", ""),
            "content_fp": content_fp,
        }
        if "content_hashes" not in state:
            state["content_hashes"] = {}
        state["content_hashes"][content_fp] = url
        _save_state(state)
    return out_path


# ── Config loading ───────────────────────────────────────────────────────────
def _load_config(config_path: Path) -> dict[str, Any]:
    import yaml

    try:
        return yaml.safe_load(config_path.read_text(encoding="utf-8"))
    except Exception:
        return json.loads(config_path.read_text(encoding="utf-8"))


# ── Main flow ────────────────────────────────────────────────────────────────
def run(
    config_path: Path | None,
    single_url: str | None,
    max_urls: int | None,
    dry_run: bool,
    write_report: bool = False,
) -> int:
    if not TRAFILATURA_AVAILABLE:
        print("ERROR: trafilatura is not installed.", file=sys.stderr)
        print("Install: pip install trafilatura", file=sys.stderr)
        return 1

    # Load sources
    entries: list[dict[str, Any]] = []
    settings: dict[str, Any] = {}
    if single_url:
        entries.append({"url": single_url, "name": "", "tags": []})
    elif config_path:
        cfg = _load_config(config_path)
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
    user_agent = settings.get(
        "user_agent",
        "llm-wiki-agent/1.0 (research article crawler; respects robots.txt)",
    )
    fallback = settings.get("fallback_to_markitdown", True)
    delay = settings.get("request_delay", 1.0)
    min_length = settings.get("content_min_length", 200)
    max_depth = settings.get("max_depth", 0)
    max_pages_per_source = settings.get("max_pages_per_source", 10)
    crawl_rules = {
        "stay_in_domain": settings.get("stay_in_domain", True),
        "include_patterns": settings.get("include_patterns", []),
        "exclude_patterns": settings.get("exclude_patterns", []),
    }

    state = _load_state()
    total_success = 0
    total_skipped = 0
    total_failed = 0

    # Global visited set for this run (prevents loops across sources)
    visited_this_run: set[str] = set()

    # Statistics collector for this run
    stats: dict[str, Any] = {
        "urls": [],
        "engines": {},
        "quality_scores": [],
        "start_time": datetime.now(timezone.utc).isoformat(),
    }

    def _process_one(url: str, name: str, tags: list[str], depth: int, base_domain: str) -> tuple[int, int, int]:
        """Process a single URL. Returns (success, skipped, failed)."""
        nonlocal total_success, total_skipped, total_failed

        if not url or url in visited_this_run:
            return 0, 1, 0
        visited_this_run.add(url)

        print(f"  [depth={depth}] {url}")

        # Deduplication (persistent)
        url_meta = state.get("url_meta", {}).get(url, {})
        etag = url_meta.get("etag", "")
        last_modified = url_meta.get("last_modified", "")

        if url in state.get("processed_urls", {}) and not dry_run and not etag and not last_modified:
            print(f"    [SKIP] Already processed")
            return 0, 1, 0

        # Fetch
        html, headers = _fetch_html(url, timeout, user_agent, etag=etag, last_modified=last_modified)
        if headers.get("not_modified"):
            print(f"    [SKIP] Not modified since last fetch")
            return 0, 1, 0
        if html is None:
            _log_failed(url, "fetch")
            return 0, 0, 1

        # Extract
        extracted = _extract_content(html, url, fallback)
        if extracted is None:
            print(f"    [FAIL] Extraction failed")
            _log_failed(url, "extraction")
            return 0, 0, 1

        # Quality gate
        if len(extracted.get("body", "")) < min_length:
            print(f"    [SKIP] Content too short ({len(extracted.get('body', ''))} chars)")
            return 0, 1, 0

        # Content fingerprint deduplication (catch same content at different URLs)
        fp = _content_fingerprint(extracted["body"])
        seen_hashes = state.get("content_hashes", {})
        if not dry_run and fp in seen_hashes and seen_hashes[fp] != url:
            print(f"    [SKIP] Duplicate content (same as {seen_hashes[fp]})")
            return 0, 1, 0

        # Quality score
        q = _score_quality(extracted["body"])
        grade = "A" if q["total"] >= 80 else "B" if q["total"] >= 60 else "C" if q["total"] >= 40 else "D"
        extracted["_quality"] = q
        extracted["_quality_grade"] = grade

        # Stats
        engine = extracted.get("engine", "unknown")
        stats["engines"][engine] = stats["engines"].get(engine, 0) + 1
        stats["quality_scores"].append(q["total"])
        stats["urls"].append({"url": url, "grade": grade, "score": q["total"], "engine": engine})

        # Write
        out_path = _write_entry(url, name, tags, extracted, dry_run, headers, fp)
        if out_path:
            print(f"    [OK] Saved to {out_path.name} ({engine}) [Q={grade}:{q['total']}]")
            return 1, 0, 0
        else:
            if dry_run:
                print(f"    [DRY] Would save [Q={grade}:{q['total']}]")
                return 1, 0, 0
            else:
                print(f"    [FAIL] Write failed")
                return 0, 0, 1

    for entry_idx, entry in enumerate(entries, 1):
        seed_url = entry.get("url", "")
        seed_name = entry.get("name", "")
        seed_tags = entry.get("tags", [])
        if not seed_url:
            continue

        print(f"\n[Source {entry_idx}/{len(entries)}] {seed_name or seed_url}")

        base_domain = urllib.parse.urlparse(seed_url).netloc
        source_pages = 0
        source_success = 0

        # BFS queue: (url, name, tags, depth)
        queue: list[tuple[str, str, list[str], int]] = [(seed_url, seed_name, seed_tags, 0)]

        while queue and source_pages < max_pages_per_source:
            url, name, tags, depth = queue.pop(0)
            s, sk, f = _process_one(url, name, tags, depth, base_domain)
            source_success += s
            total_success += s
            total_skipped += sk
            total_failed += f
            source_pages += 1

            if s > 0 and depth < max_depth:
                html, _ = _fetch_html(url, timeout, user_agent)
                if html:
                    links = _extract_links(html, url)
                    for link in links:
                        if link in visited_this_run:
                            continue
                        if not _should_follow(link, base_domain, crawl_rules):
                            continue
                        if len(queue) + source_pages < max_pages_per_source:
                            queue.append((link, "", seed_tags, depth + 1))

            if delay > 0 and queue:
                time.sleep(delay)

        print(f"  Source done: {source_success} saved, {source_pages} scanned")

    # Persist deep crawl results + update last_runs
    if not dry_run:
        state["last_runs"]["web"] = datetime.now(timezone.utc).isoformat()
        _save_state(state)

    # Build report
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


# ── CLI ──────────────────────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch web articles for LLM Wiki Agent")
    parser.add_argument("--config", type=Path, help="Path to YAML/JSON config file")
    parser.add_argument("--url", help="Fetch a single URL directly")
    parser.add_argument("--max-urls", type=int, help="Limit number of URLs to fetch")
    parser.add_argument("--dry-run", action="store_true", help="Do not write files")
    parser.add_argument("--report", action="store_true", help="Write detailed JSON report to raw-inbox/web_report.json")
    args = parser.parse_args()
    return run(args.config, args.url, args.max_urls, args.dry_run, args.report)


if __name__ == "__main__":
    sys.exit(main())
