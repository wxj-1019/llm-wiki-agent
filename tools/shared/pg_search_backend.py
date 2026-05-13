#!/usr/bin/env python3
"""PostgreSQL + pgvector search backend (同步, psycopg2 连接池).

Usage:
    from tools.shared.search_backend import get_search_backend
    backend = get_search_backend()   # auto-detects PG via config/database.yaml
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from pathlib import Path
from typing import Any

from tools.shared.search_backend import SearchBackend

try:
    from tools.shared.logging_config import get_logger
    logger = get_logger("pg_search_backend")
except ImportError:
    logger = logging.getLogger("wiki.pg_search")

REPO = Path(__file__).parent.parent.parent
WIKI = REPO / "wiki"
META_FILES = {"index.md", "log.md", "lint-report.md", "health-report.md"}

_TYPE_BOOST = {"entity": 1.2, "concept": 1.1, "source": 1.0, "synthesis": 1.05}


def _strip_frontmatter(content: str) -> str:
    if content.startswith("---"):
        match = re.search(r"^---\s*$", content[3:], re.MULTILINE)
        if match:
            return content[3 + match.end() :].strip()
    return content.strip()


def _extract_frontmatter_field(content: str, field: str) -> str:
    match = re.search(
        rf"^{re.escape(field)}:\s*[\"\']?(.*?)[\"\']?\s*$", content, re.MULTILINE
    )
    return match.group(1).strip() if match else ""


def _wiki_page_paths():
    if not WIKI.exists():
        return
    for p in WIKI.rglob("*.md"):
        if p.name not in META_FILES:
            yield p


def _file_hash(path: Path) -> str:
    stat = path.stat()
    h = hashlib.sha256()
    h.update(str(stat.st_mtime).encode())
    h.update(str(stat.st_size).encode())
    return h.hexdigest()[:16]


class PgSearchBackend(SearchBackend):
    """PostgreSQL + pgvector search backend."""

    def __init__(self, config: dict[str, Any]) -> None:
        from psycopg2 import pool

        self._vector_dim = config.get("vector_dim", 768)
        self._fts_weight = config.get("fts_weight", 0.6)
        self._vec_weight = config.get("vector_weight", 0.4)
        self._pool_min = config.get("pool_min", 2)
        self._pool_max = config.get("pool_max", 10)
        self._cjk_parser = config.get("cjk_parser", "auto")

        conn_kwargs: dict[str, Any] = {
            "host": config["host"],
            "port": config["port"],
            "dbname": config["database"],
            "user": config["user"],
            "password": config["password"],
            "sslmode": config.get("sslmode", "prefer"),
        }
        if "connect_timeout" in config:
            conn_kwargs["connect_timeout"] = config["connect_timeout"]
        if "statement_timeout" in config:
            conn_kwargs["options"] = f"-c statement_timeout={config['statement_timeout']}"

        self._pool = pool.ThreadedConnectionPool(
            minconn=self._pool_min,
            maxconn=self._pool_max,
            **conn_kwargs,
        )

        # Detect whether zh_cfg exists on PG side
        conn = self._pool.getconn()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT 1 FROM pg_ts_config WHERE cfgname = 'zh_cfg'"
            )
            self._has_zhparser = cur.fetchone() is not None
            cur.close()
        except Exception:
            self._has_zhparser = False
        finally:
            self._pool.putconn(conn)

        logger.info(
            "PgSearchBackend initialized | host=%s db=%s zhparser=%s",
            config["host"], config["database"], self._has_zhparser,
        )

    # ── Connection helpers ──

    def _getconn(self):
        return self._pool.getconn()

    def _putconn(self, conn):
        self._pool.putconn(conn)

    # ── Search ──

    def search(
        self, query: str, limit: int = 20, semantic: bool = False
    ) -> dict[str, Any]:
        t0 = time.time()
        conn = self._getconn()
        try:
            if semantic:
                results = self._hybrid_search(conn, query, limit)
            else:
                results = self._fts_search(conn, query, limit)
        finally:
            self._putconn(conn)

        did_you_mean = None
        if not results and len(query.strip()) >= 2:
            did_you_mean = self._suggest(query)
            if did_you_mean and did_you_mean.lower() != query.lower():
                conn2 = self._getconn()
                try:
                    results = self._fts_search(conn2, did_you_mean, limit)
                finally:
                    self._putconn(conn2)

        latency_ms = (time.time() - t0) * 1000
        self._record_analytics(query, len(results), "hybrid" if semantic else "fts", latency_ms, did_you_mean)

        return {
            "results": results[:limit],
            "count": len(results),
            "did_you_mean": did_you_mean,
            "degraded": False,
        }

    def _fts_search(self, conn, query: str, limit: int) -> list[dict]:
        if not query or not query.strip():
            return []
        q = query.strip()

        # If zhparser is unavailable and cjk_parser is bigram_app, tokenize CJK
        ts_config = "zh_cfg" if self._has_zhparser else "simple"
        if not self._has_zhparser and self._cjk_parser in ("auto", "bigram_app"):
            from tools.shared.cjk_utils import tokenize_cjk_bigrams
            q_tokenized = tokenize_cjk_bigrams(q)
        else:
            q_tokenized = q

        cur = conn.cursor()
        try:
            cur.execute(
                """
                SELECT path, title, page_type, ts_rank(body_tsv, websearch_to_tsquery(%s, %s)) AS rank,
                       LEFT(body, 300) AS excerpt, updated_at
                FROM wiki_pages
                WHERE body_tsv @@ websearch_to_tsquery(%s, %s)
                ORDER BY rank DESC
                LIMIT %s
                """,
                (ts_config, q_tokenized, ts_config, q_tokenized, limit * 2),
            )
            rows = cur.fetchall()
        finally:
            cur.close()

        results = []
        for row in rows:
            path, title, page_type, rank, excerpt, updated_at = row
            results.append({
                "path": path,
                "title": title,
                "type": page_type,
                "rank": rank,
                "excerpt": (excerpt or "").replace("\n", " "),
            })

        results = self._apply_ranking_boosts(results, q)
        return results

    def _hybrid_search(self, conn, query: str, limit: int) -> list[dict]:
        from tools import ollama_client

        if not ollama_client.is_available():
            return self._fts_search(conn, query, limit)

        emb = ollama_client.embed(query.strip(), model="nomic-embed-text")
        if emb is None:
            return self._fts_search(conn, query, limit)

        cur = conn.cursor()
        try:
            cur.execute(
                """
                SELECT path, title, page_type, excerpt, hybrid_score, updated_at
                FROM hybrid_search(
                    query_text => %s,
                    query_embedding => %s::halfvec,
                    result_limit => %s,
                    fts_weight => %s,
                    vec_weight => %s
                )
                """,
                (query, emb, limit * 2, self._fts_weight, self._vec_weight),
            )
            rows = cur.fetchall()
        finally:
            cur.close()

        results = []
        for row in rows:
            path, title, page_type, excerpt, score, updated_at = row
            results.append({
                "path": path,
                "title": title,
                "type": page_type,
                "rank": -score,  # More negative = higher rank, consistent with FTS
                "excerpt": (excerpt or "").replace("\n", " "),
            })

        results = self._apply_ranking_boosts(results, query)
        return results

    def _apply_ranking_boosts(self, results: list[dict], query: str) -> list[dict]:
        for r in results:
            score = 1.0 / (1.0 + abs(r["rank"]))
            boost = _TYPE_BOOST.get(r.get("type", ""), 1.0)
            title_lower = r.get("title", "").lower()
            query_lower = query.lower()
            if query_lower in title_lower:
                boost *= 1.5
            elif any(q_word in title_lower for q_word in query_lower.split()):
                boost *= 1.2
            if "auto-ingested" in r.get("excerpt", "")[:100]:
                boost *= 0.7
            score *= boost
            r["rank"] = -score
        results.sort(key=lambda x: x["rank"])
        return results

    def _suggest(self, query: str) -> str | None:
        """Simple did-you-mean using wiki titles."""
        terms = set()
        if not WIKI.exists():
            return None
        for md_file in WIKI.rglob("*.md"):
            try:
                content = md_file.read_text(encoding="utf-8")[:2000]
                for m in re.finditer(r'title:\s*["\']?([^"\'\\n]+)', content):
                    terms.add(m.group(1).strip())
                for m in re.finditer(r'\[\[([^\]]+)\]\]', content):
                    terms.add(m.group(1).strip())
            except (OSError, UnicodeDecodeError):
                continue
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

    def _record_analytics(self, query: str, result_count: int, source: str, latency_ms: float, did_you_mean: str | None = None) -> None:
        try:
            from tools.shared.state_manager import SearchAnalytics
            analytics = SearchAnalytics()
            analytics.record(query, result_count, source, latency_ms, did_you_mean)
            analytics.close()
        except Exception:
            pass

    # ── Indexing ──

    def index_page(self, page_path: str, content: str) -> None:
        title = _extract_frontmatter_field(content, "title")
        raw_type = _extract_frontmatter_field(content, "type") or "unknown"
        # Normalize to valid constraint values
        page_type = raw_type.lower().strip()
        if page_type not in ("source", "entity", "concept", "synthesis"):
            page_type = "source"
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

        # Prepare body_tsv: when zhparser is unavailable, pre-tokenize CJK with
        # app-level bigrams so that 'simple' tsconfig produces searchable tokens.
        ts_config = "zh_cfg" if self._has_zhparser else "simple"
        if not self._has_zhparser and self._cjk_parser in ("auto", "bigram_app"):
            from tools.shared.cjk_utils import tokenize_cjk_bigrams
            tsv_text = tokenize_cjk_bigrams(body)
        else:
            tsv_text = body

        conn = self._getconn()
        try:
            cur = conn.cursor()
            # Insert or update wiki_pages; supply body_tsv explicitly so the
            # trigger skips its own (non-CJK-aware) generation.
            cur.execute(
                """
                INSERT INTO wiki_pages (path, title, page_type, tags, body, source_type, body_tsv)
                VALUES (%s, %s, %s, %s, %s, %s, to_tsvector(%s, %s))
                ON CONFLICT (path) DO UPDATE SET
                    title = EXCLUDED.title,
                    page_type = EXCLUDED.page_type,
                    tags = EXCLUDED.tags,
                    body = EXCLUDED.body,
                    source_type = EXCLUDED.source_type,
                    body_tsv = EXCLUDED.body_tsv,
                    updated_at = NOW()
                """,
                (page_path, title, page_type, _parse_tags(tags), body, "legacy",
                 ts_config, tsv_text),
            )
            conn.commit()
            cur.close()
        except Exception:
            conn.rollback()
            raise
        finally:
            self._putconn(conn)

    def remove_page(self, page_path: str) -> None:
        conn = self._getconn()
        try:
            cur = conn.cursor()
            cur.execute("DELETE FROM wiki_pages WHERE path = %s", (page_path,))
            conn.commit()
            cur.close()
        except Exception:
            conn.rollback()
            raise
        finally:
            self._putconn(conn)

    def rebuild_index(self) -> None:
        """Rebuild index from wiki/ files."""
        conn = self._getconn()
        try:
            cur = conn.cursor()
            cur.execute("TRUNCATE TABLE wiki_pages CASCADE")
            conn.commit()
            cur.close()
        except Exception:
            conn.rollback()
            self._putconn(conn)
            raise
        self._putconn(conn)

        count = 0
        for p in _wiki_page_paths():
            try:
                content = p.read_text(encoding="utf-8")
                rel_path = p.relative_to(REPO).as_posix()
                self.index_page(rel_path, content)
                count += 1
            except (OSError, UnicodeDecodeError):
                continue

        logger.info("PG index rebuilt | pages=%d", count)
        print(f"Indexed {count} wiki pages into PostgreSQL.")

    def count(self) -> int:
        conn = self._getconn()
        try:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM wiki_pages")
            row = cur.fetchone()
            cur.close()
            return row[0] if row else 0
        finally:
            self._putconn(conn)

    def close(self) -> None:
        if self._pool is not None:
            self._pool.closeall()
            self._pool = None  # type: ignore[assignment]

    # ── Vector operations ──

    def rebuild_embeddings(self) -> None:
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
        if all(e is None for e in embeddings):
            print("Batch embed failed, falling back to single embeddings...")
            embeddings = [ollama_client.embed(t, model="nomic-embed-text") for t in texts]

        stored = 0
        conn = self._getconn()
        try:
            cur = conn.cursor()
            for p, emb in zip(paths, embeddings):
                if emb is None:
                    continue
                rel_path = str(p.relative_to(REPO))
                cur.execute(
                    """
                    INSERT INTO wiki_embeddings (page_path, embedding, model, updated_at)
                    VALUES (%s, %s::halfvec, %s, NOW())
                    ON CONFLICT (page_path) DO UPDATE SET
                        embedding = EXCLUDED.embedding,
                        model = EXCLUDED.model,
                        updated_at = NOW()
                    """,
                    (rel_path, emb, "nomic-embed-text"),
                )
                stored += 1
            conn.commit()
            cur.close()
        except Exception:
            conn.rollback()
            raise
        finally:
            self._putconn(conn)

        print(f"Rebuilt embeddings for {stored} / {len(pages)} pages.")


def _parse_tags(tags_str: str) -> list[str]:
    if not tags_str:
        return []
    return [t.strip() for t in tags_str.split(",") if t.strip()]
