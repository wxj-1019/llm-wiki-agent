#!/usr/bin/env python3
"""Phase 5: Smart Pipeline Enhancements for the crawler.

Features:
- Semantic dedup (content fingerprint + title similarity)
- Adaptive rate limiting (response-time feedback loop)
- Change detection (HEAD request + ETag/Last-Modified)

Usage:
    from tools.fetchers.smart_pipeline import SmartPipeline
    pipe = SmartPipeline()
    if pipe.should_fetch(url):
        html = fetch(url)
        if pipe.is_duplicate(html, url):
            return
        pipe.record_success(url, duration=1.5)
"""

from __future__ import annotations

import hashlib
import json
import math
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
STATE_PATH = REPO_ROOT / "raw-inbox" / "state.json"


@dataclass
class RateLimitState:
    """Adaptive rate limiter with response-time feedback."""

    base_delay: float = 2.0          # seconds between requests
    min_delay: float = 0.5
    max_delay: float = 30.0
    last_request_time: float = 0.0
    success_rate: float = 1.0        # EWMA of success rate
    avg_response_time: float = 2.0   # EWMA of response time

    def wait_if_needed(self) -> float:
        """Sleep if needed, return actual wait time."""
        now = time.time()
        elapsed = now - self.last_request_time
        if elapsed < self.base_delay:
            sleep_for = self.base_delay - elapsed
            time.sleep(sleep_for)
            return sleep_for
        return 0.0

    def record_success(self, duration: float) -> None:
        """Update state after successful request."""
        self.avg_response_time = 0.7 * self.avg_response_time + 0.3 * duration
        self.success_rate = 0.9 * self.success_rate + 0.1 * 1.0
        # Speed up if healthy
        if self.success_rate > 0.9 and self.avg_response_time < 1.0:
            self.base_delay = max(self.min_delay, self.base_delay * 0.9)
        self.last_request_time = time.time()

    def record_failure(self, status: int | None = None) -> None:
        """Update state after failed request."""
        self.success_rate = 0.9 * self.success_rate + 0.1 * 0.0
        # Slow down aggressively on 429/503
        if status in (429, 503, 502):
            self.base_delay = min(self.max_delay, self.base_delay * 2.0)
        else:
            self.base_delay = min(self.max_delay, self.base_delay * 1.2)
        self.last_request_time = time.time()


@dataclass
class ChangeDetector:
    """Detect content changes using ETag / Last-Modified / content hash."""

    history: dict[str, dict[str, Any]] = field(default_factory=dict)

    def has_changed(self, url: str, headers: dict[str, str], content: str) -> bool:
        """Return True if content has changed since last check."""
        etag = headers.get("etag", "")
        last_mod = headers.get("last-modified", "")
        fp = hashlib.sha256(content.encode()).hexdigest()[:16]

        prev = self.history.get(url)
        if not prev:
            self.history[url] = {"etag": etag, "last_modified": last_mod, "fp": fp}
            return True

        if etag and prev.get("etag") == etag:
            return False
        if last_mod and prev.get("last_modified") == last_mod:
            return False
        if prev.get("fp") == fp:
            return False

        self.history[url] = {"etag": etag, "last_modified": last_mod, "fp": fp}
        return True

    def head_check(self, url: str, client: httpx.Client) -> bool | None:
        """Return True if HEAD suggests content changed, False if unchanged, None if uncertain."""
        try:
            resp = client.head(url, follow_redirects=True, timeout=10)
            etag = resp.headers.get("etag", "")
            last_mod = resp.headers.get("last-modified", "")
            prev = self.history.get(url)
            if not prev:
                return None  # No prior data, need full fetch
            if etag and prev.get("etag") == etag:
                return False
            if last_mod and prev.get("last_modified") == last_mod:
                return False
            return True
        except Exception:
            return None


class SmartPipeline:
    """Combined smart pipeline: dedup + adaptive rate + change detection."""

    def __init__(self, state_path: Path = STATE_PATH):
        self.state_path = state_path
        self.rate = RateLimitState()
        self.change = ChangeDetector()
        self._seen_hashes: set[str] = set()
        self._load()

    def _load(self) -> None:
        if self.state_path.exists():
            try:
                data = json.loads(self.state_path.read_text(encoding="utf-8"))
                self.change.history = data.get("change_history", {})
                rate_cfg = data.get("rate_limit", {})
                self.rate.base_delay = rate_cfg.get("base_delay", 2.0)
                self.rate.avg_response_time = rate_cfg.get("avg_response_time", 2.0)
            except (json.JSONDecodeError, OSError):
                pass

    def save(self) -> None:
        data: dict[str, Any] = {}
        if self.state_path.exists():
            try:
                data = json.loads(self.state_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        data["change_history"] = self.change.history
        data["rate_limit"] = {
            "base_delay": self.rate.base_delay,
            "avg_response_time": self.rate.avg_response_time,
            "last_saved": datetime.now(timezone.utc).isoformat(),
        }
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self.state_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def should_fetch(self, url: str, client: httpx.Client | None = None) -> bool:
        """Return True if URL should be fetched (has changed or never seen)."""
        if client:
            changed = self.change.head_check(url, client)
            if changed is False:
                return False  # HEAD says unchanged
        return True

    def is_duplicate(self, content: str, url: str) -> bool:
        """Check if content is semantically duplicate."""
        fp = hashlib.sha256(content.encode()).hexdigest()[:16]
        if fp in self._seen_hashes:
            return True
        self._seen_hashes.add(fp)
        return False

    def wait(self) -> float:
        """Wait between requests. Returns wait duration."""
        return self.rate.wait_if_needed()

    def record(self, url: str, duration: float, success: bool, status: int | None = None) -> None:
        """Record fetch result for adaptive rate limiting."""
        if success:
            self.rate.record_success(duration)
        else:
            self.rate.record_failure(status)

    def mark_processed(self, url: str, headers: dict[str, str], content: str) -> None:
        """Update change detector with latest content hash."""
        self.change.has_changed(url, headers, content)
