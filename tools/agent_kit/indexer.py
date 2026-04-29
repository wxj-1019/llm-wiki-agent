#!/usr/bin/env python3
"""Build and incrementally update search index from parsed pages."""
from __future__ import annotations

import hashlib
import json
import logging
import re
from collections import defaultdict
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.agent_kit.types import IndexData, SearchResult, WikiPage

logger = logging.getLogger(__name__)

CACHE_FILE = Path(__file__).parent.parent.parent / ".cache" / "agent-kit-cache.json"

# Simple stop-characters for Chinese bigram filtering
_STOP_CHARS: frozenset[str] = frozenset("的了在是有个与及或那这之为而就都也但对")


def _tokenize(text: str) -> set[str]:
    """Lightweight tokenizer: English words + Chinese bigrams.

    No external dependencies (jieba not required).
    """
    tokens: set[str] = set()
    tokens.update(re.findall(r"\b[a-z]{3,}\b", text.lower()))
    for segment in re.findall(r"[\u4e00-\u9fff]+", text):
        for i in range(len(segment) - 1):
            bigram = segment[i : i + 2]
            if all(c in _STOP_CHARS for c in bigram):
                continue
            tokens.add(bigram)
    return tokens


def _compute_hash(path: Path) -> str:
    """Compute a short SHA256 hash of file contents."""
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def load_cache() -> dict[str, str]:
    """Load file hash cache {slug: sha256_prefix}."""
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Failed to load cache: %s", exc)
    return {}


def save_cache(cache: dict[str, str]) -> None:
    """Save file hash cache."""
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError as exc:
        logger.warning("Failed to save cache: %s", exc)


def detect_changes(
    pages: dict[str, WikiPage], repo_root: Path, cache: dict[str, str]
) -> tuple[set[str], set[str], set[str]]:
    """Detect which pages changed since last run.

    Returns (added, modified, deleted) slug sets.
    """
    current: dict[str, str] = {}
    for slug, page in pages.items():
        p = repo_root / page["path"]
        current[slug] = _compute_hash(p) if p.exists() else ""

    added = set(current.keys()) - set(cache.keys())
    modified = {s for s in current if s in cache and current[s] != cache[s]}
    deleted = set(cache.keys()) - set(current.keys())
    return added, modified, deleted


def _remove_slug_from_index(index: IndexData, slug: str) -> None:
    """Remove all references to a slug from the index."""
    index["page_index"].pop(slug, None)
    for key in ("inverted", "tag_index", "type_index"):
        mapping = index[key]  # type: ignore[literal-required]
        for name, slugs in list(mapping.items()):
            if slug in slugs:
                slugs.remove(slug)
                if not slugs:
                    del mapping[name]


def _add_page_to_index(index: IndexData, page: WikiPage) -> None:
    """Add a single page to the index."""
    slug = page["slug"]
    body = page["body"]
    index["page_index"][slug] = {
        "title": page["title"],
        "path": page["path"],
        "type": page["type"],
        "tags": page["tags"],
        "summary": (body[:200].replace("\n", " ") + "...") if len(body) > 200 else body,
    }

    text = f"{page['title']} {body[:500]}"
    for word in _tokenize(text):
        if slug not in index["inverted"].setdefault(word, []):
            index["inverted"][word].append(slug)

    for tag in page.get("tags", []):
        if tag and slug not in index["tag_index"].setdefault(tag, []):
            index["tag_index"][tag].append(slug)

    ptype = page["type"]
    if ptype and slug not in index["type_index"].setdefault(ptype, []):
        index["type_index"][ptype].append(slug)


def build_index(
    pages: dict[str, WikiPage],
    existing_index: IndexData | None = None,
    changed_slugs: set[str] | None = None,
) -> IndexData:
    """Build or incrementally update the search index.

    If *changed_slugs* is None, performs a full rebuild.
    Otherwise only processes the given slugs (add/modify/remove).
    """
    if existing_index is None:
        index: IndexData = {
            "page_index": {},
            "inverted": {},
            "tag_index": {},
            "type_index": {},
        }
    else:
        # Shallow copy — inner lists are mutated in-place so this is safe
        index = {
            "page_index": dict(existing_index["page_index"]),
            "inverted": {k: list(v) for k, v in existing_index["inverted"].items()},
            "tag_index": {k: list(v) for k, v in existing_index["tag_index"].items()},
            "type_index": {k: list(v) for k, v in existing_index["type_index"].items()},
        }

    slugs_to_process = changed_slugs if changed_slugs is not None else set(pages.keys())

    for slug in slugs_to_process:
        _remove_slug_from_index(index, slug)
        if slug in pages:
            _add_page_to_index(index, pages[slug])

    return index


def search_index(index: IndexData, query: str, limit: int = 5) -> list[SearchResult]:
    """Pure inverted-index search, O(k) where k = matched term count."""
    query_words = _tokenize(query)
    scores: dict[str, float] = defaultdict(float)

    for word in query_words:
        for slug in index["inverted"].get(word, []):
            scores[slug] += 1.0

    sorted_slugs = sorted(scores.keys(), key=lambda s: scores[s], reverse=True)[:limit]
    return [
        {
            "title": index["page_index"][s]["title"],
            "path": index["page_index"][s]["path"],
            "type": index["page_index"][s]["type"],
            "excerpt": index["page_index"][s]["summary"],
            "score": scores[s],
        }
        for s in sorted_slugs
        if s in index["page_index"]
    ]
