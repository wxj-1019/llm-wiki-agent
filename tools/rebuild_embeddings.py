#!/usr/bin/env python3
"""Rebuild vector embeddings for all wiki pages.

Supports checkpoint/resume for long-running jobs.
Usage:
    python tools/rebuild_embeddings.py
    python tools/rebuild_embeddings.py --checkpoint state/embed_checkpoint.json
    python tools/rebuild_embeddings.py --batch-size 10
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.resolve()
WIKI = REPO_ROOT / "wiki"
META_FILES = {"index.md", "log.md", "lint-report.md", "health-report.md"}
CHECKPOINT_PATH = REPO_ROOT / "state" / "embed_checkpoint.json"


def _wiki_page_paths():
    if not WIKI.exists():
        return
    for p in WIKI.rglob("*.md"):
        if p.name not in META_FILES:
            yield p


def _strip_frontmatter(content: str) -> str:
    import re
    if content.startswith("---"):
        match = re.search(r"^---\s*$", content[3:], re.MULTILINE)
        if match:
            return content[3 + match.end() :].strip()
    return content.strip()


def _load_checkpoint(path: Path) -> dict[str, Any]:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_checkpoint(path: Path, checkpoint: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(checkpoint, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Rebuild wiki page embeddings")
    parser.add_argument("--checkpoint", type=Path, default=CHECKPOINT_PATH, help="Checkpoint file path")
    parser.add_argument("--batch-size", type=int, default=10, help="Save checkpoint every N pages")
    parser.add_argument("--model", default="nomic-embed-text", help="Embedding model name")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be processed without calling Ollama")
    args = parser.parse_args()

    from tools import ollama_client

    if not ollama_client.is_available():
        print("ERROR: Ollama is not available. Start Ollama and try again.")
        return 1

    # Get search backend
    from tools.shared.search_backend import get_search_backend

    backend = get_search_backend()

    pages = sorted(_wiki_page_paths(), key=lambda p: str(p))
    if not pages:
        print("No wiki pages found.")
        return 0

    checkpoint = _load_checkpoint(args.checkpoint)
    last_processed = checkpoint.get("last_page", "")
    total = len(pages)
    processed = 0
    stored = 0
    failed = 0

    print(f"Total pages: {total}")
    if last_processed:
        print(f"Resuming from checkpoint: {last_processed}")

    t0 = time.time()

    for p in pages:
        rel_path = str(p.relative_to(REPO_ROOT).as_posix())
        if last_processed and rel_path <= last_processed:
            processed += 1
            continue

        try:
            content = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as e:
            print(f"  SKIP {rel_path}: read error ({e})")
            failed += 1
            continue

        clean = _strip_frontmatter(content)
        if not clean:
            print(f"  SKIP {rel_path}: empty body")
            failed += 1
            continue

        if args.dry_run:
            print(f"  [DRY] {rel_path} ({len(clean)} chars)")
            processed += 1
            stored += 1
            continue

        # Generate embedding with retry
        emb = None
        for attempt in range(3):
            try:
                emb = ollama_client.embed(clean, model=args.model)
                if emb is not None:
                    break
            except Exception as e:
                wait = 2 ** attempt
                print(f"  RETRY {rel_path} in {wait}s (attempt {attempt + 1}/3): {e}")
                time.sleep(wait)

        if emb is None:
            print(f"  FAIL {rel_path}: embedding failed after 3 retries")
            failed += 1
            continue

        # Store via backend (PgSearchBackend handles PG INSERT; SQLite ignores)
        try:
            if hasattr(backend, "_store_embedding"):
                backend._store_embedding(rel_path, emb, args.model)
            else:
                # Direct PG insertion if backend doesn't have helper
                from tools.shared.pg_search_backend import PgSearchBackend
                if isinstance(backend, PgSearchBackend):
                    conn = backend._getconn()
                    try:
                        cur = conn.cursor()
                        cur.execute(
                            """
                            INSERT INTO wiki_embeddings (page_path, embedding, model, updated_at)
                            VALUES (%s, %s::halfvec, %s, NOW())
                            ON CONFLICT (page_path) DO UPDATE SET
                                embedding = EXCLUDED.embedding,
                                model = EXCLUDED.model,
                                updated_at = NOW()
                            """,
                            (rel_path, emb, args.model),
                        )
                        conn.commit()
                        cur.close()
                    finally:
                        backend._putconn(conn)
                else:
                    # SQLite: use search_engine's direct SQL
                    import sqlite3
                    db_path = REPO_ROOT / "state" / "search.db"
                    conn = sqlite3.connect(str(db_path))
                    conn.execute(
                        "INSERT OR REPLACE INTO wiki_embeddings (path, embedding, model, updated_at) VALUES (?, ?, ?, datetime('now'))",
                        (rel_path, json.dumps(emb), args.model),
                    )
                    conn.commit()
                    conn.close()
            stored += 1
        except Exception as e:
            print(f"  FAIL {rel_path}: store error ({e})")
            failed += 1
            continue

        processed += 1
        if processed % args.batch_size == 0:
            _save_checkpoint(args.checkpoint, {"last_page": rel_path, "processed": processed, "stored": stored})
            print(f"  ... checkpoint saved ({processed}/{total})")

        print(f"  OK {rel_path}")

    elapsed = time.time() - t0
    print(f"\nDone in {elapsed:.1f}s | processed={processed} stored={stored} failed={failed}")

    # Clear checkpoint on success
    if stored > 0 and args.checkpoint.exists():
        args.checkpoint.unlink()
        print("Checkpoint cleared.")

    backend.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
