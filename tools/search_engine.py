#!/usr/bin/env python3
"""SQLite FTS5 full-text search engine for the wiki.

Zero external dependencies — uses only the Python stdlib sqlite3.
"""
from __future__ import annotations

import json
import sqlite3
import threading
import re
import hashlib
from pathlib import Path
from typing import Iterator

REPO = Path(__file__).parent.parent
WIKI = REPO / "wiki"
STATE_DIR = REPO / "state"
DB_PATH = STATE_DIR / "search.db"

META_FILES = {"index.md", "log.md", "lint-report.md", "health-report.md"}


def _ensure_db() -> sqlite3.Connection:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    # FTS5 virtual table with porter+unicode61 tokenization
    conn.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS wiki_pages USING fts5(
            title,
            content,
            path UNINDEXED,
            type UNINDEXED,
            tags UNINDEXED,
            tokenize='porter unicode61'
        )
    """)
    # Metadata table for tracking index state
    conn.execute("""
        CREATE TABLE IF NOT EXISTS index_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    # Embeddings table for semantic search
    conn.execute("""
        CREATE TABLE IF NOT EXISTS wiki_embeddings (
            path TEXT PRIMARY KEY,
            embedding TEXT,
            model TEXT,
            updated_at TEXT
        )
    """)
    conn.commit()
    return conn


def _strip_frontmatter(content: str) -> str:
    if content.startswith("---"):
        match = re.search(r"^---\s*$", content[3:], re.MULTILINE)
        if match:
            return content[3 + match.end():].strip()
    return content.strip()


def _extract_frontmatter_field(content: str, field: str) -> str:
    match = re.search(rf'^{re.escape(field)}:\s*["\']?(.*?)["\']?\s*$', content, re.MULTILINE)
    return match.group(1).strip() if match else ""


def _wiki_page_paths() -> Iterator[Path]:
    if not WIKI.exists():
        return
    for p in WIKI.rglob("*.md"):
        if p.name not in META_FILES:
            yield p


def _file_hash(path: Path) -> str:
    """Return a fast hash of file content + mtime for change detection."""
    stat = path.stat()
    h = hashlib.sha256()
    h.update(str(stat.st_mtime).encode())
    h.update(str(stat.st_size).encode())
    return h.hexdigest()[:16]


class WikiSearchEngine:
    """FTS5-backed search engine for wiki pages."""

    def __init__(self, db_path: Path | str = DB_PATH) -> None:
        self.db_path = Path(db_path)
        self._conn = _ensure_db()
        self._lock = threading.Lock()
        self._ensure_indexed()

    def _ensure_indexed(self) -> None:
        """Rebuild index if wiki directory hash has changed."""
        current_hash = self._compute_wiki_hash()
        stored_hash = self._get_meta("wiki_hash")
        if current_hash != stored_hash:
            self.rebuild_index()
            self._set_meta("wiki_hash", current_hash)

    def _compute_wiki_hash(self) -> str:
        h = hashlib.sha256()
        for p in sorted(_wiki_page_paths(), key=lambda x: str(x)):
            h.update(str(p.relative_to(WIKI)).encode())
            h.update(_file_hash(p).encode())
        return h.hexdigest()[:16]

    def _get_meta(self, key: str) -> str | None:
        row = self._conn.execute("SELECT value FROM index_meta WHERE key = ?", (key,)).fetchone()
        return row[0] if row else None

    def _set_meta(self, key: str, value: str) -> None:
        self._conn.execute(
            "INSERT OR REPLACE INTO index_meta (key, value) VALUES (?, ?)",
            (key, value),
        )
        self._conn.commit()

    def rebuild_index(self) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM wiki_pages")
            for p in _wiki_page_paths():
                self._index_one(p)
            self._conn.commit()
        count = self._conn.execute("SELECT COUNT(*) FROM wiki_pages").fetchone()[0]
        print(f"Indexed {count} wiki pages into FTS5.")

    def _index_one(self, path: Path) -> None:
        try:
            content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            return
        clean = _strip_frontmatter(content)
        title = _extract_frontmatter_field(content, "title") or path.stem
        page_type = _extract_frontmatter_field(content, "type") or "unknown"
        tags = _extract_frontmatter_field(content, "tags") or ""
        rel_path = str(path.relative_to(REPO))
        self._conn.execute(
            "INSERT INTO wiki_pages (title, content, path, type, tags) VALUES (?, ?, ?, ?, ?)",
            (title, clean, rel_path, page_type, tags),
        )

    def index_page(self, rel_path: str) -> None:
        path = REPO / rel_path
        if not path.exists() or path.name in META_FILES:
            return
        with self._lock:
            self._conn.execute("DELETE FROM wiki_pages WHERE path = ?", (rel_path,))
            self._index_one(path)
            self._conn.commit()
        self._set_meta("wiki_hash", self._compute_wiki_hash())

    def remove_page(self, rel_path: str) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM wiki_pages WHERE path = ?", (rel_path,))
            self._conn.commit()
        self._set_meta("wiki_hash", self._compute_wiki_hash())

    def _search_fts(self, query: str, limit: int = 20) -> list[dict]:
        """Search wiki pages using FTS5 MATCH."""
        if not query or not query.strip():
            return []
        q = query.strip()
        fts_query = self._build_fts_query(q)
        with self._lock:
            cursor = self._conn.execute(
                """
                SELECT path, title, type, rank, content
                FROM wiki_pages
                WHERE wiki_pages MATCH ?
                ORDER BY rank
                LIMIT ?
                """,
                (fts_query, limit),
            )
            results = []
            for row in cursor.fetchall():
                path, title, page_type, rank, content = row
                excerpt = content[:300].replace("\n", " ") if content else ""
                results.append({
                    "path": path,
                    "title": title,
                    "type": page_type,
                    "rank": rank,
                    "excerpt": excerpt,
                })
        return results

    def search(self, query: str, limit: int = 20, semantic: bool = False) -> list[dict]:
        """Search wiki pages using FTS5, optionally with semantic hybrid ranking.

        Returns list of dicts: {path, title, type, rank, excerpt}
        """
        fts_results = self._search_fts(query, limit * 2 if semantic else limit)
        if not semantic:
            return fts_results

        # Semantic hybrid search
        from tools import ollama_client
        if not ollama_client.is_available():
            return fts_results[:limit]

        query_emb = ollama_client.embed(query.strip(), model="nomic-embed-text")
        if query_emb is None:
            return fts_results[:limit]

        # Load all cached embeddings
        all_embeddings: dict[str, list[float]] = {}
        with self._lock:
            cursor = self._conn.execute("SELECT path, embedding FROM wiki_embeddings")
            for row in cursor.fetchall():
                path, emb_json = row
                try:
                    all_embeddings[path] = json.loads(emb_json)
                except json.JSONDecodeError:
                    continue

        # Compute vector scores
        vector_scores: dict[str, float] = {}
        for path, emb in all_embeddings.items():
            sim = self._cosine_similarity(query_emb, emb)
            vector_scores[path] = sim

        # Combine FTS5 and vector scores (60% FTS5 + 40% vector)
        combined: dict[str, dict] = {}

        for r in fts_results:
            path = r["path"]
            fts_score = 1.0 / (1.0 + abs(r["rank"]))
            vec_score = vector_scores.get(path, 0.0)
            combined[path] = {
                "path": path,
                "title": r["title"],
                "type": r["type"],
                "excerpt": r["excerpt"],
                "score": 0.6 * fts_score + 0.4 * vec_score,
            }

        # Add vector-only results
        top_vector = sorted(vector_scores.items(), key=lambda x: x[1], reverse=True)[:limit * 2]
        with self._lock:
            for path, vec_score in top_vector:
                if path in combined:
                    continue
                row = self._conn.execute(
                    "SELECT title, content, type FROM wiki_pages WHERE path = ?", (path,)
                ).fetchone()
                if row:
                    title, content, page_type = row
                    excerpt = content[:300].replace("\n", " ") if content else ""
                else:
                    title = Path(path).stem
                    excerpt = ""
                    page_type = "unknown"
                combined[path] = {
                    "path": path,
                    "title": title,
                    "type": page_type,
                    "excerpt": excerpt,
                    "score": 0.4 * vec_score,
                }

        # Sort by combined score descending
        sorted_results = sorted(combined.values(), key=lambda x: x["score"], reverse=True)

        final = []
        for r in sorted_results[:limit]:
            final.append({
                "path": r["path"],
                "title": r["title"],
                "type": r["type"],
                "rank": -r["score"],
                "excerpt": r["excerpt"],
            })
        return final

    def search_semantic(self, query: str, limit: int = 20) -> list[dict]:
        """Convenience method for semantic search."""
        return self.search(query, limit=limit, semantic=True)

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        """Compute cosine similarity between two vectors."""
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return dot / (norm_a * norm_b)

    def _embed_page(self, path: Path) -> list[float] | None:
        """Generate embedding for a wiki page (frontmatter stripped)."""
        from tools import ollama_client
        try:
            content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            return None
        clean = _strip_frontmatter(content)
        if not clean:
            return None
        return ollama_client.embed(clean, model="nomic-embed-text")

    def _get_embedding(self, path: str) -> list[float] | None:
        """Read cached embedding from DB."""
        row = self._conn.execute(
            "SELECT embedding FROM wiki_embeddings WHERE path = ?", (path,)
        ).fetchone()
        if not row or not row[0]:
            return None
        try:
            return json.loads(row[0])
        except json.JSONDecodeError:
            return None

    def rebuild_embeddings(self) -> None:
        """Rebuild semantic embeddings for all wiki pages."""
        from tools import ollama_client
        if not ollama_client.is_available():
            print("Ollama not available, skipping embedding rebuild.")
            return

        pages = list(_wiki_page_paths())
        texts: list[str] = []
        paths: list[Path] = []
        for p in pages:
            try:
                content = p.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            clean = _strip_frontmatter(content)
            if clean:
                texts.append(clean)
                paths.append(p)

        if not texts:
            print("No pages to embed.")
            return

        embeddings = ollama_client.batch_embed(texts, model="nomic-embed-text")

        # Fallback to single embeddings if batch fails
        if all(e is None for e in embeddings):
            print("Batch embed failed, falling back to single embeddings...")
            embeddings = [ollama_client.embed(t, model="nomic-embed-text") for t in texts]

        stored = 0
        with self._lock:
            for p, emb in zip(paths, embeddings):
                if emb is None:
                    continue
                rel_path = str(p.relative_to(REPO))
                self._conn.execute(
                    "INSERT OR REPLACE INTO wiki_embeddings (path, embedding, model, updated_at) VALUES (?, ?, ?, datetime('now'))",
                    (rel_path, json.dumps(emb), "nomic-embed-text"),
                )
                stored += 1
            self._conn.commit()
        print(f"Rebuilt embeddings for {stored} / {len(pages)} pages.")

    @staticmethod
    def _build_fts_query(q: str) -> str:
        has_cjk = bool(re.search(r'[\u4e00-\u9fff]', q))
        if not has_cjk:
            q = q.replace('"', '""')
            return f'"{q}"'

        segments = q.split()
        parts: list[str] = []
        for seg in segments:
            seg = seg.strip()
            if not seg:
                continue
            seg = seg.replace('"', '""')
            cjk_chars = [c for c in seg if '\u4e00' <= c <= '\u9fff']
            if len(cjk_chars) >= 2:
                bigrams = [cjk_chars[i] + cjk_chars[i + 1] for i in range(len(cjk_chars) - 1)]
                if bigrams:
                    parts.append("(" + " OR ".join(bigrams) + ")")
                else:
                    parts.append(cjk_chars[0])
            elif len(cjk_chars) == 1:
                parts.append(cjk_chars[0])
            else:
                parts.append(f'"{seg}"')
        return " AND ".join(parts) if parts else q

    def count(self) -> int:
        row = self._conn.execute("SELECT COUNT(*) FROM wiki_pages").fetchone()
        return row[0] if row else 0

    def close(self) -> None:
        self._conn.close()


# ── CLI ──────────────────────────────────────────────────────────

def main():
    import argparse
    cli = argparse.ArgumentParser(description="Wiki FTS5 search engine")
    cli.add_argument("--rebuild", action="store_true", help="Force rebuild index")
    cli.add_argument("--search", type=str, default="", help="Search query")
    cli.add_argument("--limit", type=int, default=10, help="Result limit")
    cli.add_argument("--semantic", action="store_true", help="Enable semantic search")
    args = cli.parse_args()

    engine = WikiSearchEngine()
    if args.rebuild:
        engine.rebuild_index()
    if args.search:
        results = engine.search(args.search, args.limit, semantic=args.semantic)
        for r in results:
            print(f"[{r['type']}] {r['title']} (rank={r['rank']:.4f})")
            print(f"  path: {r['path']}")
            print(f"  excerpt: {r['excerpt'][:200]}...")
            print()
    else:
        print(f"Indexed pages: {engine.count()}")
    engine.close()


if __name__ == "__main__":
    main()
