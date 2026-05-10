#!/usr/bin/env python3
"""Incremental wiki_embeddings rebuild into PostgreSQL pgvector using fastembed.

Usage:
    python tools/rebuild_embeddings_fastembed.py [--full]
    --full    Force full rebuild (ignore hashes)
"""
from __future__ import annotations

import argparse
import hashlib
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
EMBED_TEXT_LIMIT = 8000  # chars per page to embed (memory/speed tradeoff)
MODEL_NAME = "nomic-ai/nomic-embed-text-v1.5-Q"


def _strip_frontmatter(content: str) -> str:
    if content.startswith("---"):
        match = re.search(r"^---\s*$", content[3:], re.MULTILINE)
        if match:
            return content[3 + match.end() :].strip()
    return content.strip()


def _content_hash(text: str) -> str:
    """SHA256 hex digest of the text that will actually be embedded."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _collect_disk_pages() -> dict[str, tuple[str, str]]:
    """Return {rel_path: (content_hash, embed_text)} for all disk wiki pages."""
    result: dict[str, tuple[str, str]] = {}
    if not WIKI.exists():
        return result
    for p in WIKI.rglob("*.md"):
        if p.name in META_FILES:
            continue
        try:
            content = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        body = _strip_frontmatter(content)
        if not body:
            continue
        rel = p.relative_to(REPO_ROOT).as_posix()
        embed_text = body[:EMBED_TEXT_LIMIT]
        h = _content_hash(embed_text)
        result[rel] = (h, embed_text)
    return result


def _load_pg_state() -> dict[str, str | None]:
    """Return {path: content_hash} from wiki_pages."""
    with get_pg_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT path, content_hash FROM wiki_pages")
        rows = {r[0]: r[1] for r in cur.fetchall()}
        cur.close()
    return rows


def _load_embedding_state() -> dict[str, str | None]:
    """Return {page_path: content_hash} from wiki_embeddings."""
    with get_pg_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT page_path, content_hash FROM wiki_embeddings")
        rows = {r[0]: r[1] for r in cur.fetchall()}
        cur.close()
    return rows


def _update_hashes(updates: list[tuple[str, str]]) -> None:
    """Batch update content_hash in both wiki_pages and wiki_embeddings."""
    if not updates:
        return
    with get_pg_conn() as conn:
        cur = conn.cursor()
        # Update wiki_pages
        cur.executemany(
            "UPDATE wiki_pages SET content_hash = %s, updated_at = NOW() WHERE path = %s",
            [(h, p) for p, h in updates],
        )
        # Update wiki_embeddings
        cur.executemany(
            "UPDATE wiki_embeddings SET content_hash = %s, updated_at = NOW() WHERE page_path = %s",
            [(h, p) for p, h in updates],
        )
        cur.close()


def _delete_orphan_embeddings(orphan_paths: list[str]) -> int:
    """Remove embeddings for pages no longer on disk."""
    if not orphan_paths:
        return 0
    with get_pg_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM wiki_embeddings WHERE page_path = ANY(%s)",
            (orphan_paths,),
        )
        deleted = cur.rowcount
        cur.close()
    return deleted


def main() -> int:
    parser = argparse.ArgumentParser(description="Incremental embedding rebuild")
    parser.add_argument("--full", action="store_true", help="Force full rebuild")
    parser.add_argument("--dry-run", action="store_true", help="Show what would change without writing")
    args = parser.parse_args()

    print(f"[{datetime.now().isoformat()}] Scanning disk pages...")
    disk_pages = _collect_disk_pages()
    if not disk_pages:
        print("No wiki pages found on disk.")
        return 1
    print(f"  {len(disk_pages)} pages on disk")

    print("Loading PG state...")
    pg_hashes = _load_pg_state()
    emb_hashes = _load_embedding_state()
    print(f"  {len(pg_hashes)} pages in wiki_pages")
    print(f"  {len(emb_hashes)} embeddings in wiki_embeddings")

    # Determine work categories
    to_insert: list[tuple[str, str, str]] = []  # (path, hash, text)
    to_update: list[tuple[str, str, str]] = []  # (path, hash, text)
    to_delete: list[str] = []  # paths
    hash_updates: list[tuple[str, str]] = []  # (path, hash) for wiki_pages

    disk_paths = set(disk_pages.keys())
    pg_paths = set(pg_hashes.keys())
    emb_paths = set(emb_hashes.keys())

    for path, (h, text) in disk_pages.items():
        if path not in pg_paths:
            # Not in wiki_pages — skip (FK would fail)
            continue
        pg_h = pg_hashes.get(path)
        emb_h = emb_hashes.get(path)

        if args.full:
            if path not in emb_paths:
                to_insert.append((path, h, text))
            else:
                to_update.append((path, h, text))
            hash_updates.append((path, h))
        else:
            if path not in emb_paths:
                # Never embedded
                to_insert.append((path, h, text))
                hash_updates.append((path, h))
            elif emb_h is None:
                # Embedding exists but hash missing — backfill only
                hash_updates.append((path, h))
            elif emb_h != h:
                # Content changed
                to_update.append((path, h, text))
                hash_updates.append((path, h))
            elif pg_h is None:
                # Embedding + emb_hash exist but wiki_pages hash missing
                hash_updates.append((path, h))

    # Orphans: in embeddings but not on disk
    to_delete = list(emb_paths - disk_paths)

    total_work = len(to_insert) + len(to_update)
    print(f"\nWork plan {'(DRY RUN)' if args.dry_run else ''}:")
    print(f"  Insert: {len(to_insert)}")
    print(f"  Update: {len(to_update)}")
    print(f"  Delete: {len(to_delete)}")
    print(f"  Unchanged: {len(disk_pages) - total_work}")
    print(f"  Backfill hashes: {len(hash_updates) - total_work}")

    if args.dry_run:
        if to_insert:
            print("\n  Would insert:")
            for p, _, _ in to_insert[:5]:
                print(f"    + {p}")
            if len(to_insert) > 5:
                print(f"    ... and {len(to_insert) - 5} more")
        if to_update:
            print("\n  Would update:")
            for p, _, _ in to_update[:5]:
                print(f"    ~ {p}")
            if len(to_update) > 5:
                print(f"    ... and {len(to_update) - 5} more")
        if to_delete:
            print("\n  Would delete:")
            for p in to_delete[:5]:
                print(f"    - {p}")
            if len(to_delete) > 5:
                print(f"    ... and {len(to_delete) - 5} more")
        return 0

    if total_work == 0 and not to_delete and not hash_updates:
        print("\nEverything up to date. Nothing to do.")
        return 0

    # --- Execute changes ---

    # 1. Update page hashes first
    if hash_updates:
        print(f"\nUpdating {len(hash_updates)} page hashes...")
        _update_hashes(hash_updates)

    # 2. Delete orphans
    if to_delete:
        deleted = _delete_orphan_embeddings(to_delete)
        print(f"Deleted {deleted} orphan embeddings.")

    # 3. Embed changed/new pages
    work_queue = to_insert + to_update
    if work_queue:
        print(f"\nLoading fastembed model ({MODEL_NAME})...")
        from fastembed import TextEmbedding

        model = TextEmbedding(model_name=MODEL_NAME)

        total = len(work_queue)
        print(f"Embedding {total} pages in batches of {BATCH_SIZE}...")

        stored = 0
        with get_pg_conn() as conn:
            cur = conn.cursor()
            for i in range(0, total, BATCH_SIZE):
                batch = work_queue[i : i + BATCH_SIZE]
                batch_texts = [t for _, _, t in batch]
                vectors = list(model.embed(batch_texts))
                for (path, h, _), vec in zip(batch, vectors):
                    vec_list = vec.tolist() if hasattr(vec, "tolist") else list(vec)
                    cur.execute(
                        """
                        INSERT INTO wiki_embeddings (page_path, embedding, model, updated_at, content_hash)
                        VALUES (%s, %s::halfvec, %s, NOW(), %s)
                        ON CONFLICT (page_path) DO UPDATE SET
                            embedding = EXCLUDED.embedding,
                            model = EXCLUDED.model,
                            updated_at = NOW(),
                            content_hash = EXCLUDED.content_hash
                        """,
                        (path, vec_list, MODEL_NAME, h),
                    )
                    stored += 1
                print(
                    f"  Batch {i // BATCH_SIZE + 1}/{(total - 1) // BATCH_SIZE + 1}: "
                    f"{stored}/{total} stored"
                )
            cur.close()
        print(f"\nStored {stored} embeddings.")

    # 4. Final stats
    with get_pg_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM wiki_embeddings")
        total_emb = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM wiki_pages")
        total_pages = cur.fetchone()[0]
        cur.close()
    print(f"wiki_embeddings: {total_emb} | wiki_pages: {total_pages}")
    print(f"[{datetime.now().isoformat()}] Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
