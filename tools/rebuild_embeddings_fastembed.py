#!/usr/bin/env python3
"""Rebuild wiki_embeddings into PostgreSQL pgvector using fastembed (CPU, no Ollama needed).

Usage:
    python tools/rebuild_embeddings_fastembed.py
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "tools"))

import re
from datetime import datetime

from tools.jarvis.jarvis_pg import get_pg_conn

WIKI = REPO_ROOT / "wiki"
META_FILES = {"index.md", "log.md", "lint-report.md", "health-report.md"}
BATCH_SIZE = 1


def _strip_frontmatter(content: str) -> str:
    if content.startswith("---"):
        match = re.search(r"^---\s*$", content[3:], re.MULTILINE)
        if match:
            return content[3 + match.end() :].strip()
    return content.strip()


def _wiki_page_paths():
    if not WIKI.exists():
        return
    for p in WIKI.rglob("*.md"):
        if p.name not in META_FILES:
            yield p


def main() -> int:
    print("Loading fastembed model (nomic-embed-text-v1.5-Q)...")
    from fastembed import TextEmbedding

    model = TextEmbedding(model_name="nomic-ai/nomic-embed-text-v1.5-Q")

    # Only embed pages that are already indexed in wiki_pages (FK constraint)
    with get_pg_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT path FROM wiki_pages")
        indexed_paths = {r[0] for r in cur.fetchall()}
        cur.close()

    pages = []
    texts = []
    for p in sorted(_wiki_page_paths(), key=lambda x: str(x)):
        try:
            content = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        body = _strip_frontmatter(content)
        if body:
            rel_path = str(p.relative_to(REPO_ROOT))
            # wiki_pages uses forward-slash paths
            rel_path = rel_path.replace("\\", "/")
            if rel_path in indexed_paths:
                pages.append(rel_path)
                texts.append(body[:1000])

    if not texts:
        print("No indexed wiki pages found.")
        return 1

    total = len(texts)
    print(f"Embedding {total} indexed pages in batches of {BATCH_SIZE}...")

    stored = 0
    with get_pg_conn() as conn:
        cur = conn.cursor()
        for i in range(0, total, BATCH_SIZE):
            batch_pages = pages[i : i + BATCH_SIZE]
            batch_texts = texts[i : i + BATCH_SIZE]
            vectors = list(model.embed(batch_texts))
            for path, vec in zip(batch_pages, vectors):
                vec_list = vec.tolist() if hasattr(vec, "tolist") else list(vec)
                cur.execute(
                    """
                    INSERT INTO wiki_embeddings (page_path, embedding, model, updated_at)
                    VALUES (%s, %s::halfvec, %s, NOW())
                    ON CONFLICT (page_path) DO UPDATE SET
                        embedding = EXCLUDED.embedding,
                        model = EXCLUDED.model,
                        updated_at = NOW()
                    """,
                    (path, vec_list, "nomic-embed-text-v1.5-Q"),
                )
                stored += 1
            print(f"  Batch {i // BATCH_SIZE + 1}/{(total - 1) // BATCH_SIZE + 1}: {stored}/{total} stored")
        cur.close()

    print(f"\nStored {stored} embeddings.")

    with get_pg_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM wiki_embeddings")
        total_emb = cur.fetchone()[0]
        cur.close()
    print(f"wiki_embeddings total in PG: {total_emb}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
