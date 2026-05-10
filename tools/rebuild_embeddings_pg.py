#!/usr/bin/env python3
"""Rebuild wiki_embeddings into PostgreSQL pgvector (requires Ollama).

Usage:
    # 1. Install Ollama from https://ollama.com/download
    # 2. Pull embedding model
    ollama pull nomic-embed-text
    # 3. Run this script
    python tools/rebuild_embeddings_pg.py
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(REPO_ROOT / "tools"))

from tools.shared.search_backend import get_search_backend


def main() -> int:
    backend = get_search_backend()
    pg_count = backend.count()
    print(f"Wiki pages in PG index: {pg_count}")

    print("Rebuilding embeddings via PgSearchBackend...")
    backend.rebuild_embeddings()

    # Verify
    from tools.jarvis.jarvis_pg import get_pg_conn
    with get_pg_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM wiki_embeddings")
        emb_count = cur.fetchone()[0]
        cur.close()

    print(f"wiki_embeddings in PG: {emb_count} rows")
    if emb_count == 0:
        print("WARNING: No embeddings were built. Is Ollama running?")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
