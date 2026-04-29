#!/usr/bin/env python3
"""Optional semantic vector search using fastembed (zero external API calls).

Gracefully degrades to pure inverted-index search if fastembed is not installed.
"""
from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING

try:
    from fastembed import TextEmbedding  # type: ignore[import-untyped]
    FASTEMBED_AVAILABLE = True
except Exception:
    FASTEMBED_AVAILABLE = False

if TYPE_CHECKING:
    from tools.agent_kit.types import WikiPage

logger = logging.getLogger(__name__)

# Cache file for embeddings
EMBEDDING_CACHE = Path(__file__).parent.parent.parent / ".cache" / "agent-kit-embeddings.json"

# Default lightweight model
DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def _compute_page_hash(page: WikiPage) -> str:
    """Compute a content hash for a page."""
    content = page.get("body", "") + page.get("title", "")
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


def _load_embedding_cache() -> dict:
    if EMBEDDING_CACHE.exists():
        try:
            return json.loads(EMBEDDING_CACHE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save_embedding_cache(cache: dict) -> None:
    EMBEDDING_CACHE.parent.mkdir(parents=True, exist_ok=True)
    EMBEDDING_CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def build_embeddings(
    pages: dict[str, WikiPage],
    model_name: str = DEFAULT_MODEL,
) -> dict[str, list[float]]:
    """Build or load cached embeddings for all pages.

    Returns a dict mapping slug -> embedding vector.
    If fastembed is not installed, returns empty dict.
    """
    if not FASTEMBED_AVAILABLE:
        logger.info("fastembed not installed; skipping semantic search.")
        return {}

    cache = _load_embedding_cache()
    model_cache = cache.get(model_name, {})
    embeddings: dict[str, list[float]] = {}
    to_embed: list[tuple[str, str]] = []  # (slug, text)

    for slug, page in pages.items():
        page_hash = _compute_page_hash(page)
        cached = model_cache.get(slug)
        if cached and cached.get("hash") == page_hash:
            embeddings[slug] = cached["vector"]
        else:
            text = page.get("title", "") + "\n" + page.get("body", "")[:2000]
            to_embed.append((slug, text))

    if to_embed:
        logger.info("Embedding %d pages with %s...", len(to_embed), model_name)
        try:
            embedder = TextEmbedding(model_name=model_name)
            texts = [text for _, text in to_embed]
            vectors = list(embedder.embed(texts))
            for (slug, _), vector in zip(to_embed, vectors):
                vec = vector.tolist() if hasattr(vector, "tolist") else list(vector)
                embeddings[slug] = vec
                model_cache[slug] = {
                    "hash": _compute_page_hash(pages[slug]),
                    "vector": vec,
                }
            cache[model_name] = model_cache
            _save_embedding_cache(cache)
        except Exception as exc:
            logger.warning("Embedding failed: %s", exc)
            return {}

    return embeddings


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def semantic_search(
    query: str,
    pages: dict[str, WikiPage],
    embeddings: dict[str, list[float]],
    limit: int = 5,
) -> list[dict]:
    """Search pages by semantic similarity to query.

    Falls back to empty list if embeddings are empty.
    """
    if not embeddings or not FASTEMBED_AVAILABLE:
        return []

    try:
        embedder = TextEmbedding(model_name=DEFAULT_MODEL)
        query_vector = next(iter(embedder.embed([query])))
        query_vec = query_vector.tolist() if hasattr(query_vector, "tolist") else list(query_vector)
    except Exception as exc:
        logger.warning("Query embedding failed: %s", exc)
        return []

    scored: list[tuple[float, str]] = []
    for slug, vec in embeddings.items():
        score = cosine_similarity(query_vec, vec)
        scored.append((score, slug))

    scored.sort(reverse=True)
    results: list[dict] = []
    for score, slug in scored[:limit]:
        page = pages.get(slug, {})
        results.append({
            "slug": slug,
            "title": page.get("title", slug),
            "type": page.get("type", "page"),
            "score": round(score, 4),
        })

    return results
