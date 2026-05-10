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
    from tools.shared.state_manager import get_pipeline_state
    return get_pipeline_state()


def save_state(state: dict[str, Any]) -> None:
    """Atomically save shared state to disk."""
    from tools.shared.state_manager import save_pipeline_state
    save_pipeline_state(state)


def clear_state_cache() -> None:
    """Clear the in-memory state cache (useful in tests)."""
    from tools.shared.state_manager import clear_pipeline_state_cache
    clear_pipeline_state_cache()


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
    """Shared retry state across all fetchers (JSON or PG pipeline_state.extra_meta)."""

    def __init__(self, state_file: Path | None = None):
        self._state_file = state_file or (REPO_ROOT / "state" / "retry_state.json")
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state: dict = load_json(self._state_file) or {}
        self._pg = self._pg_available()

    def _pg_available(self) -> bool:
        try:
            from tools.shared.state_manager import _load_pg_config
            return _load_pg_config() is not None
        except Exception:
            return False

    def _pg_conn(self):
        from tools.shared.state_manager import _pg_connection
        return _pg_connection()

    def _get_extra_meta(self, url: str) -> dict:
        if not self._pg:
            return {}
        conn = self._pg_conn()
        try:
            cur = conn.cursor()
            cur.execute("SELECT extra_meta FROM pipeline_state WHERE url = %s", (url,))
            row = cur.fetchone()
            cur.close()
            return row[0] if row and row[0] else {}
        finally:
            conn.close()

    def _set_extra_meta(self, url: str, meta: dict) -> None:
        if not self._pg:
            return
        conn = self._pg_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO pipeline_state (url, extra_meta) VALUES (%s, %s) "
                "ON CONFLICT (url) DO UPDATE SET extra_meta = EXCLUDED.extra_meta",
                (url, json.dumps(meta)),
            )
            conn.commit()
            cur.close()
        finally:
            conn.close()

    def should_retry(self, url: str) -> tuple[bool, str]:
        info = self._state.get(url) or self._get_extra_meta(url).get("retry", {})
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
        if self._pg:
            meta = self._get_extra_meta(url)
            meta["retry"] = info
            self._set_extra_meta(url, meta)

    def _save(self):
        save_json(self._state_file, self._state)


class ContentFingerprint:
    """Detect duplicate content via SHA256 (JSON or PG content_fingerprints table)."""

    def __init__(self, state_file: Path | None = None):
        self._state_file = state_file or (REPO_ROOT / "state" / "content_fingerprints.json")
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state: dict = load_json(self._state_file) or {}
        self._pg = self._pg_available()

    def _pg_available(self) -> bool:
        try:
            from tools.shared.state_manager import _load_pg_config
            return _load_pg_config() is not None
        except Exception:
            return False

    def _pg_conn(self):
        from tools.shared.state_manager import _pg_connection
        return _pg_connection()

    def check_and_record(self, content: str, url: str) -> tuple[bool, int]:
        h = hashlib.sha256(content.encode("utf-8")).hexdigest()
        # Check JSON cache
        if h in self._state:
            entry = self._state[h]
            entry["count"] = entry.get("count", 0) + 1
            entry["last_seen"] = datetime.now().isoformat()
            if url not in entry.get("urls", []):
                entry.setdefault("urls", []).append(url)
            self._save()
            self._upsert_pg(h, url, entry["count"])
            return True, entry["count"]

        # Check PG table
        if self._pg:
            seen_count = self._query_pg(h)
            if seen_count > 0:
                self._upsert_pg(h, url, seen_count + 1)
                self._state[h] = {
                    "count": seen_count + 1,
                    "first_seen": datetime.now().isoformat(),
                    "last_seen": datetime.now().isoformat(),
                    "urls": [url],
                }
                self._save()
                return True, seen_count + 1

        self._state[h] = {
            "count": 1,
            "first_seen": datetime.now().isoformat(),
            "last_seen": datetime.now().isoformat(),
            "urls": [url],
        }
        self._save()
        self._upsert_pg(h, url, 1)
        return False, 1

    def _query_pg(self, h: str) -> int:
        if not self._pg:
            return 0
        conn = self._pg_conn()
        try:
            cur = conn.cursor()
            cur.execute("SELECT seen_count FROM content_fingerprints WHERE hash = %s", (h,))
            row = cur.fetchone()
            cur.close()
            return row[0] if row else 0
        finally:
            conn.close()

    def _upsert_pg(self, h: str, url: str, count: int) -> None:
        if not self._pg:
            return
        conn = self._pg_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO content_fingerprints (hash, first_url, seen_count, last_seen) "
                "VALUES (%s, %s, %s, NOW()) "
                "ON CONFLICT (hash) DO UPDATE SET seen_count = EXCLUDED.seen_count, last_seen = NOW()",
                (h, url, count),
            )
            conn.commit()
            cur.close()
        finally:
            conn.close()

    def _save(self):
        save_json(self._state_file, self._state)


class DomainHealthTracker:
    """Track per-domain failure rates (JSON or PG domain_strategies table)."""

    def __init__(self, state_file: Path | None = None):
        self._state_file = state_file or (REPO_ROOT / "state" / "domain_health.json")
        self._state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state: dict = load_json(self._state_file) or {}
        self._pg = self._pg_available()

    def _pg_available(self) -> bool:
        try:
            from tools.shared.state_manager import _load_pg_config
            return _load_pg_config() is not None
        except Exception:
            return False

    def _pg_conn(self):
        from tools.shared.state_manager import _pg_connection
        return _pg_connection()

    def _load_pg(self, domain: str) -> dict:
        if not self._pg:
            return {}
        conn = self._pg_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT success_count, failure_count, updated_at FROM domain_strategies WHERE domain = %s",
                (domain,),
            )
            row = cur.fetchone()
            cur.close()
            if row:
                return {"successes": row[0] or 0, "failures": row[1] or 0, "last_attempt": row[2].isoformat() if row[2] else ""}
            return {}
        finally:
            conn.close()

    def _save_pg(self, domain: str, info: dict) -> None:
        if not self._pg:
            return
        conn = self._pg_conn()
        try:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO domain_strategies (domain, success_count, failure_count, updated_at) "
                "VALUES (%s, %s, %s, NOW()) "
                "ON CONFLICT (domain) DO UPDATE SET "
                "success_count = EXCLUDED.success_count, failure_count = EXCLUDED.failure_count, updated_at = NOW()",
                (domain, info.get("successes", 0), info.get("failures", 0)),
            )
            conn.commit()
            cur.close()
        finally:
            conn.close()

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
        self._save_pg(domain, info)

    def is_dead(self, domain: str) -> bool:
        info = self._state.get(domain) or self._load_pg(domain)
        if not info:
            return False
        total = info.get("successes", 0) + info.get("failures", 0)
        if total < 10:
            return False
        return info.get("failures", 0) / total > 0.5

    def failure_rate(self, domain: str) -> float:
        info = self._state.get(domain) or self._load_pg(domain)
        if not info:
            return 0.0
        total = info.get("successes", 0) + info.get("failures", 0)
        return info.get("failures", 0) / total if total > 0 else 0.0

    def _save(self):
        save_json(self._state_file, self._state)
