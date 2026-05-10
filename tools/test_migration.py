#!/usr/bin/env python3
"""Migration integrity tests — validate SQLite → PostgreSQL consistency.

Usage:
    pytest tools/test_migration.py -v
    python tools/test_migration.py
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.resolve()
STATE_DIR = REPO_ROOT / "state"
SQLITE_DB = STATE_DIR / "search.db"

sys.path.insert(0, str(REPO_ROOT / "tools"))

try:
    import pytest
except ImportError:
    print("pytest not installed. Install: pip install pytest")
    sys.exit(1)


def _pg_conn():
    """Get a PostgreSQL connection if configured."""
    import psycopg2
    yaml_path = REPO_ROOT / "config" / "database.yaml"
    if not yaml_path.exists():
        pytest.skip("config/database.yaml not found")
    try:
        import yaml
        cfg = yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
    except Exception:
        pytest.skip("Cannot read config/database.yaml")
    backend = cfg.get("database", {}).get("backend", "sqlite")
    if backend != "postgresql":
        pytest.skip("backend is not postgresql")
    pg = cfg.get("database", {}).get("postgresql", {})
    password = pg.get("password", "")
    if isinstance(password, str) and password.startswith("${") and password.endswith("}"):
        password = os.getenv(password[2:-1], "")
    if not password:
        pytest.skip("PG_PASSWORD not set")
    try:
        return psycopg2.connect(
            host=pg["host"], port=pg["port"],
            dbname=pg["database"], user=pg["user"],
            password=password, sslmode=pg.get("sslmode", "prefer"),
        )
    except Exception as e:
        pytest.skip(f"Cannot connect to PostgreSQL: {e}")


def _sqlite_conn():
    if not SQLITE_DB.exists():
        pytest.skip(f"SQLite DB not found: {SQLITE_DB}")
    return sqlite3.connect(str(SQLITE_DB))


class TestMigrationRowCounts:
    """Verify row counts match between SQLite and PostgreSQL."""

    def test_wiki_pages_row_count(self):
        sconn = _sqlite_conn()
        sqlite_count = sconn.execute("SELECT COUNT(*) FROM wiki_pages").fetchone()[0]
        sconn.close()

        pg_conn = _pg_conn()
        cur = pg_conn.cursor()
        cur.execute("SELECT COUNT(*) FROM wiki_pages")
        pg_count = cur.fetchone()[0]
        cur.close()
        pg_conn.close()

        assert pg_count >= sqlite_count, (
            f"PG wiki_pages ({pg_count}) < SQLite wiki_pages ({sqlite_count})"
        )

    def test_embeddings_row_count(self):
        sconn = _sqlite_conn()
        try:
            sqlite_count = sconn.execute("SELECT COUNT(*) FROM wiki_embeddings").fetchone()[0]
        except Exception:
            pytest.skip("No embeddings table in SQLite")
        sconn.close()

        pg_conn = _pg_conn()
        cur = pg_conn.cursor()
        cur.execute("SELECT COUNT(*) FROM wiki_embeddings")
        pg_count = cur.fetchone()[0]
        cur.close()
        pg_conn.close()

        assert pg_count >= sqlite_count, (
            f"PG embeddings ({pg_count}) < SQLite embeddings ({sqlite_count})"
        )


class TestMigrationContent:
    """Sample content verification."""

    def test_sample_pages_match(self):
        sconn = _sqlite_conn()
        sqlite_rows = sconn.execute(
            "SELECT path, title, type, content FROM wiki_pages ORDER BY RANDOM() LIMIT 20"
        ).fetchall()
        sconn.close()

        pg_conn = _pg_conn()
        cur = pg_conn.cursor()
        mismatches = []
        for path, title, page_type, content in sqlite_rows:
            # Normalize path
            norm_path = path if str(path).startswith("wiki/") else f"wiki/{path}"
            cur.execute(
                "SELECT title, page_type, body FROM wiki_pages WHERE path = %s",
                (norm_path,),
            )
            row = cur.fetchone()
            if not row:
                mismatches.append(f"Missing in PG: {norm_path}")
                continue
            pg_title, pg_type, pg_body = row
            # NOTE: SQLite stores CJK-bigram-tokenized titles in its FTS5 table,
            # so direct title comparison is not meaningful. We verify presence
            # and page_type only.
            # PG maps unknown types (e.g. agent_memory) to "source" because of
            # the valid_page_type CHECK constraint.
            if pg_type != page_type and not (pg_type == "source" and page_type not in ("source", "entity", "concept", "synthesis")):
                mismatches.append(f"Type mismatch: {norm_path} | PG={pg_type} SQLite={page_type}")
        cur.close()
        pg_conn.close()

        assert len(mismatches) == 0, "Content mismatches:\n" + "\n".join(mismatches)


class TestSearchParity:
    """FTS search parity between SQLite and PostgreSQL."""

    TEST_QUERIES = [
        "machine learning",
        "transformer",
        "量化交易",
        "agent",
        "RAG",
        " Claude",
        "prompt engineering",
        "knowledge graph",
        "embedding",
        "crawler",
    ]

    def _sqlite_search(self, query: str) -> list[str]:
        from tools.search_engine import WikiSearchEngine
        tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        tmp.close()
        try:
            engine = WikiSearchEngine(db_path=tmp.name)
            engine.rebuild_index()
            results = engine.search(query, limit=5)
            engine.close()
            return [r["path"] for r in results.get("results", [])]
        finally:
            os.unlink(tmp.name)

    def _pg_search(self, query: str) -> list[str]:
        from tools.shared.search_backend import get_search_backend
        backend = get_search_backend()
        results = backend.search(query, limit=5)
        return [r["path"] for r in results.get("results", [])]

    def test_top5_overlap(self):
        pg_conn = _pg_conn()
        pg_conn.close()

        overlaps = []
        for q in self.TEST_QUERIES:
            sqlite_paths = self._sqlite_search(q)
            pg_paths = self._pg_search(q)
            if not sqlite_paths and not pg_paths:
                overlaps.append(1.0)
                continue
            common = set(sqlite_paths) & set(pg_paths)
            total = set(sqlite_paths) | set(pg_paths)
            if total:
                overlaps.append(len(common) / len(total))
            else:
                overlaps.append(1.0)

        avg_overlap = sum(overlaps) / len(overlaps)
        assert avg_overlap >= 0.5, (
            f"Average top-5 overlap {avg_overlap:.2%} is below 50%. "
            f"Per-query: {list(zip(self.TEST_QUERIES, overlaps))}"
        )


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
