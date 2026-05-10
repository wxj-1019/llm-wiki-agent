#!/usr/bin/env python3
"""Common utilities shared across wiki fetchers.

Provides atomic state management, safe path generation, config loading,
and shared helpers to eliminate duplication between fetcher modules.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
STATE_PATH = REPO_ROOT / "raw-inbox" / "state.json"
FAILED_LOG_PATH = REPO_ROOT / "raw-inbox" / "failed_urls.json"

_state_lock = threading.Lock()
_state_cache: dict[str, Any] | None = None


def load_state() -> dict[str, Any]:
    """Load shared state from disk with in-memory caching."""
    global _state_cache
    with _state_lock:
        if _state_cache is not None:
            return _state_cache.copy()
        if STATE_PATH.exists():
            try:
                data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                data = {}
        else:
            data = {}
        defaults = {"processed_urls": {}, "last_runs": {}, "url_meta": {}, "content_hashes": {}}
        for k, v in defaults.items():
            data.setdefault(k, v)
        _state_cache = data
        return data.copy()


def save_state(state: dict[str, Any]) -> None:
    """Atomically save shared state to disk."""
    with _state_lock:
        STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = STATE_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(STATE_PATH)
        global _state_cache
        _state_cache = state.copy()


def clear_state_cache() -> None:
    """Clear the in-memory state cache (useful in tests)."""
    global _state_cache
    _state_cache = None


def slugify(text: str, max_len: int = 80) -> str:
    """Convert text to a URL-safe slug.

    Handles CJK characters by trying pypinyin (if installed) or falling
    back to ASCII extraction + hash suffix for readability on all platforms.
    """
    if not text or not text.strip():
        return "untitled"

    text = text.strip()
    # Detect CJK characters
    has_cjk = bool(re.search(r"[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]", text))

    if has_cjk:
        # Try pypinyin if available
        try:
            from pypinyin import lazy_pinyin
            py_parts = lazy_pinyin(text)
            py_text = "-".join(py_parts).lower()
            py_text = re.sub(r"[^\w\s-]", "", py_text)
            py_text = re.sub(r"[-\s]+", "-", py_text).strip("-")
            if py_text and len(py_text) >= 3:
                return py_text[:max_len]
        except Exception:
            pass

        # Fallback: extract ASCII tokens, append short hash of full text
        ascii_tokens = re.findall(r"[a-zA-Z0-9]+", text)
        ascii_part = "-".join(t.lower() for t in ascii_tokens if len(t) >= 2)
        short_hash = hashlib.md5(text.encode("utf-8")).hexdigest()[:6]
        if ascii_part and len(ascii_part) >= 3:
            slug = f"{ascii_part}-{short_hash}"
        else:
            slug = f"article-{short_hash}"
        return slug[:max_len]

    # Standard ASCII slugify
    text = re.sub(r"[^\w\s-]", "", text.lower())
    text = re.sub(r"[-\s]+", "-", text).strip("-")
    return text[:max_len] or "untitled"


def safe_write_path(
    out_dir: Path,
    title: str,
    date_prefix: str | None = None,
    ext: str = ".md",
) -> Path:
    """Generate a unique, safe output path inside *out_dir*.

    Raises ValueError if the resolved path would escape *out_dir* (path traversal).
    """
    if date_prefix is None:
        date_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    base_slug = slugify(title)
    filename = f"{date_prefix}-{base_slug}{ext}"
    out_path = out_dir / filename
    counter = 1
    while out_path.exists():
        filename = f"{date_prefix}-{base_slug}-{counter}{ext}"
        out_path = out_dir / filename
        counter += 1

    # Path-traversal guard
    resolved = out_path.resolve()
    resolved_dir = out_dir.resolve()
    try:
        resolved.relative_to(resolved_dir)
    except ValueError:
        raise ValueError(f"Path traversal detected: {out_path}")
    return out_path


def load_config(path: Path) -> dict[str, Any]:
    """Load YAML or JSON config. Falls back to JSON if yaml is missing / fails."""
    text = path.read_text(encoding="utf-8")
    try:
        import yaml
        return yaml.safe_load(text) or {}
    except Exception:
        return json.loads(text)


def log_failed(url: str, reason: str) -> None:
    """Append a failed URL to the persistent failure log."""
    entries: list[dict[str, Any]] = []
    if FAILED_LOG_PATH.exists():
        try:
            entries = json.loads(FAILED_LOG_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            entries = []
    entries.append({
        "url": url,
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    FAILED_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    FAILED_LOG_PATH.write_text(json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8")


def content_fingerprint(text: str) -> str:
    """Simple content fingerprint for deduplication (first 1 KB normalized)."""
    import hashlib
    normalized = re.sub(r"\s+", " ", text.lower())[:1024].strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]


def escape_yaml_value(val: str) -> str:
    """Escape a string for double-quoted YAML frontmatter."""
    return val.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")


def load_json(path: Path) -> dict[str, Any] | list | None:
    """Load a JSON file, returning None on missing/error."""
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def save_json(path: Path, data: Any) -> None:
    """Atomically write JSON to *path*."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


class RetryStateManager:
    """Shared retry state across all fetchers."""

    def __init__(self, state_file: Path | None = None):
        self._state_file = state_file or (REPO_ROOT / "state" / "retry_state.json")
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state: dict = load_json(self._state_file) or {}

    def should_retry(self, url: str) -> tuple[bool, str]:
        info = self._state.get(url)
        if not info:
            return True, "first attempt"
        next_retry = info.get("next_retry", "")
        if next_retry and datetime.now().isoformat() < next_retry:
            return False, f"cooldown until {next_retry}"
        retries = info.get("retries", 0)
        if retries >= 5:
            return False, f"max retries ({retries}) reached"
        return True, f"retry #{retries + 1}"

    def record_attempt(self, url: str, success: bool):
        if url not in self._state:
            self._state[url] = {"retries": 0, "last_attempt": "", "next_retry": ""}
        info = self._state[url]
        info["last_attempt"] = datetime.now().isoformat()
        if success:
            info["retries"] = 0
            info["next_retry"] = ""
        else:
            info["retries"] = info.get("retries", 0) + 1
            backoff_min = min(60 * 2 ** (info["retries"] - 1), 1440)
            from datetime import timedelta
            info["next_retry"] = (datetime.now() + timedelta(minutes=backoff_min)).isoformat()
        self._save()

    def _save(self):
        save_json(self._state_file, self._state)


class ContentFingerprint:
    """Detect duplicate content via SHA256."""

    def __init__(self, state_file: Path | None = None):
        self._state_file = state_file or (REPO_ROOT / "state" / "content_fingerprints.json")
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state: dict = load_json(self._state_file) or {}

    def check_and_record(self, content: str, url: str) -> tuple[bool, int]:
        h = hashlib.sha256(content.encode("utf-8")).hexdigest()
        if h in self._state:
            entry = self._state[h]
            entry["count"] = entry.get("count", 0) + 1
            entry["last_seen"] = datetime.now().isoformat()
            if url not in entry.get("urls", []):
                entry.setdefault("urls", []).append(url)
            self._save()
            return True, entry["count"]
        self._state[h] = {
            "count": 1,
            "first_seen": datetime.now().isoformat(),
            "last_seen": datetime.now().isoformat(),
            "urls": [url],
        }
        self._save()
        return False, 1


class DomainHealthTracker:
    """Track per-domain failure rates."""

    def __init__(self, state_file: Path | None = None):
        self._state_file = state_file or (REPO_ROOT / "state" / "domain_health.json")
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state: dict = load_json(self._state_file) or {}

    def record(self, domain: str, success: bool):
        if domain not in self._state:
            self._state[domain] = {"successes": 0, "failures": 0, "last_attempt": ""}
        info = self._state[domain]
        if success:
            info["successes"] = info.get("successes", 0) + 1
        else:
            info["failures"] = info.get("failures", 0) + 1
        info["last_attempt"] = datetime.now().isoformat()
        self._save()

    def is_dead(self, domain: str) -> bool:
        info = self._state.get(domain)
        if not info:
            return False
        total = info.get("successes", 0) + info.get("failures", 0)
        if total < 10:
            return False
        return info.get("failures", 0) / total > 0.5

    def failure_rate(self, domain: str) -> float:
        info = self._state.get(domain)
        if not info:
            return 0.0
        total = info.get("successes", 0) + info.get("failures", 0)
        return info.get("failures", 0) / total if total > 0 else 0.0

    def _save(self):
        save_json(self._state_file, self._state)
