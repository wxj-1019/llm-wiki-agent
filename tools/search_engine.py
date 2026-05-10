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
from typing import Iterator, Any

from tools.shared.search_backend import SearchBackend

try:
    from shared.logging_config import get_logger
    logger = get_logger("search_engine")
except ImportError:
    try:
        from tools.shared.logging_config import get_logger
        logger = get_logger("search_engine")
    except ImportError:
        import logging
        logger = logging.getLogger("wiki.search_engine")

REPO = Path(__file__).parent.parent
WIKI = REPO / "wiki"
STATE_DIR = REPO / "state"
DB_PATH = STATE_DIR / "search.db"

META_FILES = {"index.md", "log.md", "lint-report.md", "health-report.md"}


def _ensure_db() -> sqlite3.Connection:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    # FTS5 virtual table with porter+unicode61 tokenization.
    # CJK text is pre-tokenized into character bigrams before insertion
    # because unicode61 doesn't split CJK characters by default.
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


class WikiSearchEngine(SearchBackend):
    """FTS5-backed search engine for wiki pages. Implements SearchBackend."""

    def __init__(self, db_path: Path | str = DB_PATH) -> None:
        self.db_path = Path(db_path)
        self._conn = _ensure_db()
        self._lock = threading.RLock()
        self._last_check = 0.0
        self._ensure_indexed()

    def _ensure_indexed(self) -> None:
        """Rebuild index if wiki directory hash has changed."""
        current_hash = self._compute_wiki_hash()
        stored_hash = self._get_meta("wiki_hash")
        if current_hash != stored_hash:
            self.rebuild_index()
            self._set_meta("wiki_hash", current_hash)

    def check_stale(self) -> None:
        """Lightweight stale check using file count + total size. Called on every search."""
        import time
        now = time.monotonic()
        if now - self._last_check < 3.0:
            return
        self._last_check = now
        try:
            stored = self._get_meta("wiki_fingerprint")
            count = 0
            total_size = 0
            for p in _wiki_page_paths():
                try:
                    total_size += p.stat().st_size
                    count += 1
                except OSError:
                    pass
            current = f"{count}:{total_size}"
            if stored != current:
                logger.info("Wiki changed (files=%d size=%d), reindexing", count, total_size)
                self._ensure_indexed()
                self._set_meta("wiki_fingerprint", current)
        except Exception:
            pass

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
        logger.info("FTS5 index rebuilt | pages=%d", count)
        print(f"Indexed {count} wiki pages into FTS5.")

    def _index_one(self, path: Path) -> None:
        try:
            content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as e:
            logger.debug("Skipped indexing file | path=%s error_type=%s", path.name, type(e).__name__)
            return
        clean = _strip_frontmatter(content)
        # Tokenize CJK text into bigrams for proper FTS5 indexing
        clean = self._tokenize_cjk_for_index(clean)
        title = _extract_frontmatter_field(content, "title") or path.stem
        title_tokenized = self._tokenize_cjk_for_index(title)
        page_type = _extract_frontmatter_field(content, "type") or "unknown"
        tags = _extract_frontmatter_field(content, "tags") or ""
        rel_path = path.relative_to(REPO).as_posix()
        self._conn.execute(
            "INSERT INTO wiki_pages (title, content, path, type, tags) VALUES (?, ?, ?, ?, ?)",
            (title_tokenized, clean, rel_path, page_type, tags),
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

    def index_page(self, page_path: str, content: str) -> None:
        """Index a single page (abstract impl). Delegates to update_page."""
        self.update_page(page_path, content)

    def update_page(self, page_path: str, content: str) -> None:
        """Update a single page in FTS5 index without full rebuild.

        Deletes existing entry and re-inserts with updated content.
        CJK text is tokenized into bigrams for proper FTS5 matching.
        """
        with self._lock:
            self._conn.execute("DELETE FROM wiki_pages WHERE path = ?", (page_path,))
            title = _extract_frontmatter_field(content, "title")
            page_type = _extract_frontmatter_field(content, "type") or "unknown"
            tags = _extract_frontmatter_field(content, "tags") or ""
            body = _strip_frontmatter(content)
            # Strip markdown formatting
            body = re.sub(r'\[\[([^\]]+)\|[^\]]*\]\]', r'\1', body)
            body = re.sub(r'\[\[([^\]]+)\]\]', r'\1', body)
            body = re.sub(r'#+\s+', '', body)
            body = re.sub(r'\*\*([^*]+)\*\*', r'\1', body)
            body = re.sub(r'\*([^*]+)\*', r'\1', body)
            body = re.sub(r'`([^`]+)`', r'\1', body)
            body = re.sub(r'```[^`]*```', '', body, flags=re.DOTALL)
            # CJK bigram tokenization
            body = self._tokenize_cjk_for_index(body)
            title_tokenized = self._tokenize_cjk_for_index(title)
            self._conn.execute(
                "INSERT INTO wiki_pages (title, content, path, type, tags) VALUES (?, ?, ?, ?, ?)",
                (title_tokenized, body, page_path, page_type, tags),
            )
            self._conn.commit()
        self._set_meta("wiki_hash", self._compute_wiki_hash())

    def _search_fts(self, query: str, limit: int = 20) -> list[dict]:
        """Search wiki pages using FTS5 MATCH."""
        if not query or not query.strip():
            return []
        q = query.strip()
        fts_query = self._build_fts_query(q)
        with self._lock:
            try:
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
            except Exception as e:
                logger.warning("FTS5 MATCH failed, retrying with escaped query | query=%s error_type=%s error=%s",
                               q[:100], type(e).__name__, e)
                cursor = self._conn.execute(
                    """
                    SELECT path, title, type, rank, content
                    FROM wiki_pages
                    WHERE wiki_pages MATCH ?
                    ORDER BY rank
                    LIMIT ?
                    """,
                    (q.replace('"', '""'), limit),
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
        logger.info("FTS5 search | query=%s results=%d limit=%d", q[:100], len(results), limit)
        return results

    # ── Ranking constants ──
    _TYPE_BOOST = {"entity": 1.2, "concept": 1.1, "source": 1.0, "synthesis": 1.05}
    _RECENCY_BOOST_DAYS = 90  # Boost pages updated within this many days

    def search(
        self, query: str, limit: int = 20, semantic: bool = False,
    ) -> dict[str, Any]:
        """Search wiki pages using FTS5, with ranking boosts and fuzzy fallback.

        Returns dict: {results: [...], count, did_you_mean, degraded}
        Each result: {path, title, type, rank, excerpt}
        """
        self.check_stale()
        results = self._search_fts(query, limit * 2 if semantic else limit)

        # Apply ranking boosts
        results = self._apply_ranking_boosts(results, query)

        # Record analytics
        try:
            _analytics = SearchAnalytics()
            _analytics.record(query=query, result_count=len(results), source="fts", latency_ms=0)
            _analytics.close()
        except Exception:
            pass

        # Did-you-mean for zero results
        did_you_mean = None
        if not results and len(query.strip()) >= 2:
            fuzzy = FuzzyMatcher()
            suggestion = fuzzy.suggest(query, threshold=2)
            if suggestion and suggestion.lower() != query.lower():
                did_you_mean = suggestion
                # Auto-retry with suggestion
                results = self._search_fts(suggestion, limit)
                results = self._apply_ranking_boosts(results, suggestion)

        if not semantic:
            return {
                "results": results[:limit],
                "count": len(results),
                "did_you_mean": did_you_mean,
                "degraded": False,
            }

        # ── Semantic hybrid search ──
        from tools import ollama_client
        if not ollama_client.is_available():
            return {"results": results[:limit], "count": len(results), "did_you_mean": did_you_mean, "degraded": True}

        query_emb = ollama_client.embed(query.strip(), model="nomic-embed-text")
        if query_emb is None:
            return {"results": results[:limit], "count": len(results), "did_you_mean": did_you_mean, "degraded": True}

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
        for r in results:
            path = r["path"]
            fts_score = 1.0 / (1.0 + abs(r["rank"]))
            vec_score = vector_scores.get(path, 0.0)
            combined[path] = {
                "path": path, "title": r["title"], "type": r["type"],
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
                    "path": path, "title": title, "type": page_type,
                    "excerpt": excerpt, "score": 0.4 * vec_score,
                }

        sorted_results = sorted(combined.values(), key=lambda x: x["score"], reverse=True)
        final = []
        for r in sorted_results[:limit]:
            final.append({
                "path": r["path"], "title": r["title"], "type": r["type"],
                "rank": -r["score"], "excerpt": r["excerpt"],
            })
        return {"results": final, "count": len(final), "did_you_mean": did_you_mean, "degraded": False}

    def _apply_ranking_boosts(self, results: list[dict], query: str) -> list[dict]:
        """Apply ranking boosts: type priority, title match, recency."""
        for r in results:
            score = 1.0 / (1.0 + abs(r["rank"]))
            # Type boost
            boost = self._TYPE_BOOST.get(r.get("type", ""), 1.0)
            # Title exact match boost
            title_lower = r.get("title", "").lower()
            query_lower = query.lower()
            if query_lower in title_lower:
                boost *= 1.5
            elif any(q_word in title_lower for q_word in query_lower.split()):
                boost *= 1.2
            # Penalize auto-ingested stubs
            if "auto-ingested" in r.get("excerpt", "")[:100]:
                boost *= 0.7
            score *= boost
            r["rank"] = -score  # More negative = higher rank
        results.sort(key=lambda x: x["rank"])
        return results

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

    def search_semantic(self, query: str, limit: int = 20) -> dict[str, Any]:
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
    def _tokenize_cjk_for_index(text: str) -> str:
        """Convert CJK text to space-separated character bigrams for FTS5 indexing.

        '量化交易系统' → '量化 化交 交易 易系 系统'
        This ensures FTS5 unicode61 can tokenize CJK text properly.
        Non-CJK text is preserved as-is.
        """
        result: list[str] = []
        cjk_buf: list[str] = []
        non_cjk_buf: list[str] = []

        def _flush_cjk():
            if not cjk_buf:
                return
            # Generate overlapping bigrams
            chars = ''.join(cjk_buf)
            if len(chars) == 1:
                result.append(chars)
            else:
                for i in range(len(chars) - 1):
                    result.append(chars[i:i+2])
                # Also add first and last char for single-char matching
                # (to handle edge cases where a query has just 1 char)
            cjk_buf.clear()

        def _flush_non_cjk():
            if non_cjk_buf:
                result.append(''.join(non_cjk_buf))
                non_cjk_buf.clear()

        for ch in text:
            if '\u4e00' <= ch <= '\u9fff':
                _flush_non_cjk()
                cjk_buf.append(ch)
            elif ch.isspace():
                _flush_cjk()
                _flush_non_cjk()
            else:
                if cjk_buf:
                    _flush_cjk()
                non_cjk_buf.append(ch)

        _flush_cjk()
        _flush_non_cjk()
        return ' '.join(r for r in result if r.strip())

    @staticmethod
    def _tokenize_cjk_for_query(text: str) -> str:
        """Convert CJK query text to bigram tokens for FTS5 search.

        '量化交易' → '"量化" AND "交易"'
        Single characters are kept as-is.
        """
        cjk_chars: list[str] = []
        non_cjk_parts: list[str] = []
        buf: list[str] = []
        cur_is_cjk = False

        def _flush():
            nonlocal cur_is_cjk
            if not buf:
                return
            part = ''.join(buf)
            buf.clear()
            if cur_is_cjk:
                cjk_chars.append(part)
            else:
                non_cjk_parts.append(part)

        for ch in text:
            ch_is_cjk = '\u4e00' <= ch <= '\u9fff'
            if buf and ch_is_cjk != cur_is_cjk:
                _flush()
            if not ch.isspace():
                buf.append(ch)
                cur_is_cjk = ch_is_cjk

        _flush()

        # Build FTS5 query parts
        parts: list[str] = []

        # Non-CJK: exact match
        for t in non_cjk_parts:
            parts.append(f'"{t}"')

        # CJK: build bigrams
        if cjk_chars:
            cjk_text = ''.join(cjk_chars)
            bigrams = []
            if len(cjk_text) == 1:
                bigrams.append(cjk_text)
            else:
                for i in range(len(cjk_text) - 1):
                    bigrams.append(cjk_text[i:i+2])
            if bigrams:
                parts.append('(' + ' AND '.join(f'"{bg}"' for bg in bigrams) + ')')

        if not parts:
            return f'"{text}"'
        return ' AND '.join(parts)

    @staticmethod
    def _build_fts_query(q: str) -> str:
        """Build an FTS5 query string. Uses CJK bigram tokenization."""
        return WikiSearchEngine._tokenize_cjk_for_query(q.strip())

    def count(self) -> int:
        row = self._conn.execute("SELECT COUNT(*) FROM wiki_pages").fetchone()
        return row[0] if row else 0

    def close(self) -> None:
        self._conn.close()
        self._conn = None


class SearchAnalytics:
    """Record search queries for zero-result analysis."""

    def __init__(self, db_path: Path | None = None):
        self._db_path = db_path or (REPO / "state" / "search_analytics.db")
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self._db_path))
        self._conn.execute("CREATE TABLE IF NOT EXISTS search_queries (id INTEGER PRIMARY KEY, timestamp TEXT, query TEXT, result_count INTEGER, source TEXT, latency_ms REAL, did_you_mean TEXT)")
        self._conn.commit()

    def record(self, query: str, result_count: int, source: str = "api", latency_ms: float = 0, did_you_mean: str | None = None):
        from datetime import datetime
        self._conn.execute("INSERT INTO search_queries (timestamp, query, result_count, source, latency_ms, did_you_mean) VALUES (?, ?, ?, ?, ?, ?)", (datetime.now().isoformat(), query, result_count, source, latency_ms, did_you_mean))
        self._conn.commit()

    def get_zero_result_queries(self, days: int = 7) -> list[dict]:
        from datetime import datetime, timedelta
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        rows = self._conn.execute("SELECT query, COUNT(*) as cnt FROM search_queries WHERE result_count = 0 AND timestamp > ? GROUP BY query ORDER BY cnt DESC LIMIT 20", (cutoff,)).fetchall()
        return [{"query": r[0], "count": r[1]} for r in rows]

    def get_stats(self, days: int = 7) -> dict:
        from datetime import datetime, timedelta
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        total = self._conn.execute("SELECT COUNT(*) FROM search_queries WHERE timestamp > ?", (cutoff,)).fetchone()[0]
        zero = self._conn.execute("SELECT COUNT(*) FROM search_queries WHERE result_count = 0 AND timestamp > ?", (cutoff,)).fetchone()[0]
        return {"total_queries": total, "zero_result_count": zero, "zero_result_rate": round(zero / total * 100, 1) if total > 0 else 0}

    def close(self):
        self._conn.close()


class FuzzyMatcher:
    """Suggest corrections for zero-result queries."""

    def __init__(self, db_path: Path | None = None):
        self._db_path = db_path or (REPO / "state" / "search_analytics.db")
        self._term_cache: list[str] | None = None
        self._cache_time: float = 0

    def suggest(self, query: str, threshold: int = 2) -> str | None:
        """Return closest match if edit distance <= threshold, else None."""
        terms = self._get_wiki_terms()
        if not terms:
            return None
        try:
            from difflib import get_close_matches
            matches = get_close_matches(query.lower(), [t.lower() for t in terms], n=1, cutoff=0.6)
            if matches:
                for t in terms:
                    if t.lower() == matches[0]:
                        return t
        except Exception:
            pass
        return None

    def _get_wiki_terms(self) -> list[str]:
        import time as _time
        now = _time.time()
        if self._term_cache and now - self._cache_time < 300:
            return self._term_cache
        terms = set()
        wiki_dir = REPO / "wiki"
        if not wiki_dir.exists():
            return []
        for md_file in wiki_dir.rglob("*.md"):
            try:
                content = md_file.read_text(encoding="utf-8")[:2000]
                for m in re.finditer(r'title:\s*["\']?([^"\'\\n]+)', content):
                    terms.add(m.group(1).strip())
                for m in re.finditer(r'\[\[([^\]]+)\]\]', content):
                    terms.add(m.group(1).strip())
            except (OSError, UnicodeDecodeError):
                continue
        self._term_cache = sorted(terms)
        self._cache_time = now
        return self._term_cache


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
        result = engine.search(args.search, args.limit, semantic=args.semantic)
        results = result["results"]
        if result.get("did_you_mean"):
            print(f"Did you mean: {result['did_you_mean']}?")
            print()
        for r in results:
            print(f"[{r['type']}] {r['title']} (rank={r['rank']:.4f})")
            print(f"  path: {r['path']}")
            print(f"  excerpt: {r['excerpt'][:200]}...")
            print()
        if not results:
            print("No results found.")
    else:
        print(f"Indexed pages: {engine.count()}")
    engine.close()


if __name__ == "__main__":
    main()
