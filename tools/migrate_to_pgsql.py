#!/usr/bin/env python3
"""Migrate wiki data from SQLite to PostgreSQL + pgvector.

Usage:
    python tools/migrate_to_pgsql.py --dry-run          # validate without writing
    python tools/migrate_to_pgsql.py                    # full migration
    python tools/migrate_to_pgsql.py --tables wiki      # migrate only wiki_pages
    python tools/migrate_to_pgsql.py --verify           # verify migration integrity

Requires:
    pip install psycopg2-binary pgvector
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).parent.parent.resolve()
# Ensure repo root is on path for sibling imports
_repo = str(REPO_ROOT)
if _repo not in sys.path:
    sys.path.insert(0, _repo)

STATE_DIR = REPO_ROOT / "state"
SQLITE_DB = STATE_DIR / "search.db"
SQLITE_SCHEDULER = STATE_DIR / "scheduler_metrics.db"
SQLITE_ANALYTICS = STATE_DIR / "search_analytics.db"
STATE_JSON = REPO_ROOT / "raw-inbox" / "state.json"
SCHEMA_SQL = REPO_ROOT / "config" / "schema.sql"

# Tables to migrate (set via --tables flag)
ALL_TABLES = ["wiki", "embeddings", "pipeline", "scheduler", "analytics", "aux"]


# ── Utilities ───────────────────────────────────────────────────────────────
def _load_pg_config() -> dict[str, Any]:
    """Load PostgreSQL config from config/database.yaml or env vars."""
    config: dict[str, Any] = {
        "host": os.getenv("PG_HOST", "localhost"),
        "port": int(os.getenv("PG_PORT", "5432")),
        "database": os.getenv("PG_DATABASE", "llm_wiki"),
        "user": os.getenv("PG_USER", "wiki_user"),
        "password": os.getenv("PG_PASSWORD", ""),
        "sslmode": "prefer",
    }

    yaml_path = REPO_ROOT / "config" / "database.yaml"
    if yaml_path.exists():
        try:
            import yaml
            cfg = yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
            db_cfg = cfg.get("database", {}).get("postgresql", {})
            for key in config:
                if key in db_cfg and db_cfg[key]:
                    val = db_cfg[key]
                    if isinstance(val, str) and val.startswith("${") and val.endswith("}"):
                        env_key = val[2:-1]
                        config[key] = os.getenv(env_key, "")
                    else:
                        config[key] = val
        except Exception:
            pass

    if not config["password"]:
        print("WARNING: PG_PASSWORD not set. Set PG_PASSWORD env var or config/database.yaml")
    return config


def _connect_pg(config: dict) -> Any:
    """Connect to PostgreSQL with psycopg2."""
    import psycopg2
    return psycopg2.connect(
        host=config["host"], port=config["port"],
        dbname=config["database"], user=config["user"],
        password=config["password"], sslmode=config.get("sslmode", "prefer"),
    )


def _sqlite_row_count(conn: sqlite3.Connection, table: str) -> int:
    try:
        return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    except Exception:
        return 0


# ── Migration Steps ─────────────────────────────────────────────────────────

def _migrate_schema(pg_conn, dry_run: bool) -> bool:
    """Apply schema.sql to PostgreSQL."""
    if not SCHEMA_SQL.exists():
        print("ERROR: schema.sql not found at:", SCHEMA_SQL)
        return False
    sql = SCHEMA_SQL.read_text(encoding="utf-8")
    if dry_run:
        print("[DRY] Would execute schema.sql")
        return True
    try:
        pg_conn.cursor().execute(sql)
        pg_conn.commit()
        print("  Schema applied successfully.")
        return True
    except Exception as e:
        print(f"  ERROR applying schema: {e}")
        pg_conn.rollback()
        return False


def _migrate_wiki_pages(sqlite_conn, pg_conn, dry_run: bool) -> int:
    """Migrate wiki_pages from SQLite FTS5 to PostgreSQL."""
    try:
        rows = sqlite_conn.execute(
            "SELECT path, title, type, tags, content FROM wiki_pages"
        ).fetchall()
    except Exception as e:
        print(f"  WARNING: Cannot read wiki_pages from SQLite: {e}")
        return 0

    if dry_run:
        print(f"[DRY] Would migrate {len(rows)} wiki pages")
        return len(rows)

    cursor = pg_conn.cursor()
    migrated = 0
    for path, title, page_type, tags, body in rows:
        try:
            # Normalize path: SQLite may store 'wiki/sources/X' or 'sources/X'
            if not str(path).startswith("wiki/"):
                path = f"wiki/{path}"

            # Normalize page_type to valid constraint values
            raw_type = str(page_type or "source").lower().strip()
            if raw_type not in ("source", "entity", "concept", "synthesis"):
                raw_type = "source"

            # Tokenize CJK into bigrams if zhparser is not available
            body_tokenized = _tokenize_cjk_bigrams(body)
            title_tokenized = _tokenize_cjk_bigrams(str(title))

            cursor.execute("SAVEPOINT sp_wiki_page")
            cursor.execute("""
                INSERT INTO wiki_pages (path, title, page_type, tags, body, body_tsv, source_type)
                VALUES (%s, %s, %s, %s, %s,
                        to_tsvector('simple', %s || ' ' || %s),
                        'legacy')
                ON CONFLICT (path) DO UPDATE SET
                    title = EXCLUDED.title,
                    body = EXCLUDED.body,
                    body_tsv = EXCLUDED.body_tsv,
                    updated_at = NOW()
            """, (
                path, str(title), raw_type,
                _parse_tags(str(tags or "")),
                body, title_tokenized, body_tokenized,
            ))
            cursor.execute("RELEASE SAVEPOINT sp_wiki_page")
            migrated += 1
        except Exception as e:
            try:
                cursor.execute("ROLLBACK TO SAVEPOINT sp_wiki_page")
            except Exception:
                pass
            print(f"  WARNING: Failed to insert {path}: {e}")
            continue

    pg_conn.commit()
    print(f"  Wiki pages: {migrated}/{len(rows)} migrated")
    return migrated


def _migrate_embeddings(sqlite_conn, pg_conn, dry_run: bool) -> int:
    """Migrate cached embeddings from SQLite to pgvector."""
    try:
        rows = sqlite_conn.execute(
            "SELECT path, embedding, model FROM wiki_embeddings"
        ).fetchall()
    except Exception:
        print("  No embeddings table in SQLite — skipping.")
        return 0

    if dry_run:
        print(f"[DRY] Would migrate {len(rows)} embeddings")
        return len(rows)

    cursor = pg_conn.cursor()
    migrated = 0
    for path, emb_json, model in rows:
        try:
            if not emb_json:
                continue
            emb_list = json.loads(emb_json)
            if not emb_list or len(emb_list) != 768:
                print(f"  WARNING: Bad embedding for {path}: len={len(emb_list) if emb_list else 0}")
                continue

            if not str(path).startswith("wiki/"):
                path = f"wiki/{path}"

            # halfvec expects a list of floats
            cursor.execute("""
                INSERT INTO wiki_embeddings (page_path, embedding, model)
                VALUES (%s, %s::halfvec, %s)
                ON CONFLICT (page_path) DO UPDATE SET
                    embedding = EXCLUDED.embedding,
                    updated_at = NOW()
            """, (path, emb_list, model or "nomic-embed-text"))
            migrated += 1
        except Exception as e:
            print(f"  WARNING: Failed to insert embedding for {path}: {e}")
            continue

    pg_conn.commit()
    print(f"  Embeddings: {migrated}/{len(rows)} migrated")
    return migrated


def _migrate_pipeline_state(dry_run: bool) -> int:
    """Migrate state.json to pipeline_state table."""
    if not STATE_JSON.exists():
        print("  No state.json — skipping pipeline state migration.")
        return 0

    state = json.loads(STATE_JSON.read_text(encoding="utf-8"))
    entries: list[dict] = []

    # Collect from url_meta
    url_meta = state.get("url_meta", {})
    processed = state.get("processed_urls", {})

    for url, meta in url_meta.items():
        entries.append({
            "url": url,
            "etag": meta.get("etag", ""),
            "last_modified": meta.get("last_modified", ""),
            "content_hash": meta.get("content_fp", ""),
            "status": "ingested" if url in processed else "fetched",
        })

    # Also add processed_urls that aren't in url_meta
    for url in processed:
        if url not in url_meta:
            entries.append({"url": url, "status": "ingested"})

    # Auto-ingested
    for rel_path in state.get("auto_ingested", []):
        entries.append({
            "url": f"file://{rel_path}",
            "status": "ingested",
        })

    if dry_run:
        print(f"[DRY] Would migrate {len(entries)} pipeline state entries")
        return len(entries)

    config = _load_pg_config()
    pg_conn = _connect_pg(config)
    cursor = pg_conn.cursor()
    migrated = 0
    for entry in entries:
        try:
            cursor.execute("""
                INSERT INTO pipeline_state (url, etag, last_modified, content_hash, status)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (url) DO UPDATE SET
                    etag = EXCLUDED.etag,
                    last_modified = EXCLUDED.last_modified,
                    content_hash = EXCLUDED.content_hash,
                    status = EXCLUDED.status
            """, (
                entry["url"], entry.get("etag", ""),
                entry.get("last_modified", ""), entry.get("content_hash", ""),
                entry.get("status", "fetched"),
            ))
            migrated += 1
        except Exception as e:
            print(f"  WARNING: Failed to insert {entry['url']}: {e}")
    pg_conn.commit()
    pg_conn.close()
    print(f"  Pipeline state: {migrated}/{len(entries)} migrated")
    return migrated


def _migrate_scheduler(sqlite_scheduler: Path, pg_conn, dry_run: bool) -> int:
    """Migrate scheduler_metrics.db → scheduler_jobs."""
    if not sqlite_scheduler.exists():
        print("  No scheduler_metrics.db — skipping.")
        return 0

    sconn = sqlite3.connect(str(sqlite_scheduler))
    try:
        rows = sconn.execute(
            "SELECT job_name, timestamp, status, duration_sec, items_count, error_message "
            "FROM job_runs ORDER BY id"
        ).fetchall()
    except Exception:
        print("  No job_runs table — skipping.")
        sconn.close()
        return 0

    if dry_run:
        print(f"[DRY] Would migrate {len(rows)} scheduler jobs")
        sconn.close()
        return len(rows)

    cursor = pg_conn.cursor()
    migrated = 0
    for job_name, ts, status, duration, items, error in rows:
        try:
            cursor.execute("""
                INSERT INTO scheduler_jobs (job_name, started_at, status, duration_ms, items_count, error_msg)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (job_name, ts, status, (duration or 0) * 1000, items or 0, error or ""))
            migrated += 1
        except Exception:
            continue
    pg_conn.commit()
    sconn.close()
    print(f"  Scheduler jobs: {migrated}/{len(rows)} migrated")
    return migrated


def _migrate_analytics(sqlite_analytics: Path, pg_conn, dry_run: bool) -> int:
    """Migrate search_analytics.db → search_queries."""
    if not sqlite_analytics.exists():
        print("  No search_analytics.db — skipping.")
        return 0

    aconn = sqlite3.connect(str(sqlite_analytics))
    try:
        rows = aconn.execute(
            "SELECT timestamp, query, result_count, source, latency_ms, did_you_mean "
            "FROM search_queries ORDER BY id"
        ).fetchall()
    except Exception:
        print("  No search_queries table — skipping.")
        aconn.close()
        return 0

    if dry_run:
        print(f"[DRY] Would migrate {len(rows)} search queries")
        aconn.close()
        return len(rows)

    cursor = pg_conn.cursor()
    migrated = 0
    for ts, query, count, source, latency, dym in rows:
        try:
            cursor.execute("""
                INSERT INTO search_queries (timestamp, query, result_count, source, latency_ms, did_you_mean)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (ts, query, count, source or "fts", latency or 0, dym or ""))
            migrated += 1
        except Exception:
            continue
    pg_conn.commit()
    aconn.close()
    print(f"  Search analytics: {migrated}/{len(rows)} migrated")
    return migrated


# ── Helpers ─────────────────────────────────────────────────────────────────
def _tokenize_cjk_bigrams(text: str) -> str:
    """Generate CJK bigrams for tsvector 'simple' config fallback."""
    from tools.shared.cjk_utils import tokenize_cjk_bigrams
    return tokenize_cjk_bigrams(text)


def _parse_tags(tags_str: str) -> list[str]:
    """Parse comma-separated tags into a list."""
    if not tags_str:
        return []
    return [t.strip() for t in tags_str.split(",") if t.strip()]


# ── Verification ────────────────────────────────────────────────────────────
def _verify_migration(pg_config: dict) -> dict[str, Any]:
    """Compare SQLite and PostgreSQL row counts."""
    report: dict[str, Any] = {"tables": {}, "passed": True}

    pg_conn = _connect_pg(pg_config)
    pg_cur = pg_conn.cursor()

    # wiki_pages
    if SQLITE_DB.exists():
        sconn = sqlite3.connect(str(SQLITE_DB))
        sqlite_count = _sqlite_row_count(sconn, "wiki_pages")
        sconn.close()

        pg_cur.execute("SELECT COUNT(*) FROM wiki_pages")
        pg_count = pg_cur.fetchone()[0]
        ok = pg_count >= sqlite_count  # PG may have more (pre-existing)
        report["tables"]["wiki_pages"] = {"sqlite": sqlite_count, "pg": pg_count, "ok": ok}
        if not ok:
            report["passed"] = False

    # embeddings
    if SQLITE_DB.exists():
        sconn = sqlite3.connect(str(SQLITE_DB))
        try:
            sqlite_emb = _sqlite_row_count(sconn, "wiki_embeddings")
            pg_cur.execute("SELECT COUNT(*) FROM wiki_embeddings")
            pg_emb = pg_cur.fetchone()[0]
            report["tables"]["wiki_embeddings"] = {"sqlite": sqlite_emb, "pg": pg_emb,
                                                     "ok": pg_emb >= sqlite_emb}
        except Exception:
            pass
        sconn.close()

    # scheduler
    if SQLITE_SCHEDULER.exists():
        sconn = sqlite3.connect(str(SQLITE_SCHEDULER))
        try:
            sqlite_jobs = _sqlite_row_count(sconn, "job_runs")
            pg_cur.execute("SELECT COUNT(*) FROM scheduler_jobs")
            pg_jobs = pg_cur.fetchone()[0]
            report["tables"]["scheduler_jobs"] = {"sqlite": sqlite_jobs, "pg": pg_jobs,
                                                   "ok": pg_jobs >= sqlite_jobs}
        except Exception:
            pass
        sconn.close()

    pg_conn.close()
    return report


# ── CLI ─────────────────────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate wiki data from SQLite to PostgreSQL")
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing")
    parser.add_argument("--verify", action="store_true", help="Verify migration integrity")
    parser.add_argument("--tables", nargs="+", choices=ALL_TABLES, default=ALL_TABLES,
                        help=f"Tables to migrate (default: all = {ALL_TABLES})")
    parser.add_argument("--skip-schema", action="store_true", help="Skip applying schema.sql")
    args = parser.parse_args()

    # Verify mode
    if args.verify:
        config = _load_pg_config()
        print("\n=== Migration Verification ===\n")
        report = _verify_migration(config)
        for table, info in report["tables"].items():
            status = "OK" if info["ok"] else "MISMATCH"
            print(f"  {table}: SQLite={info.get('sqlite','?')}, PG={info.get('pg','?')} [{status}]")
        print(f"\nOverall: {'PASS' if report['passed'] else 'FAIL — some tables have fewer rows in PG'}")
        return 0 if report["passed"] else 1

    config = _load_pg_config()
    print(f"\n{'='*60}")
    print(f"Migrating to PostgreSQL: {config['host']}:{config['port']}/{config['database']}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"Tables: {args.tables}")
    print(f"{'='*60}\n")

    t0 = time.time()

    # Connect
    if args.dry_run:
        pg_conn = None
    else:
        try:
            pg_conn = _connect_pg(config)
            print("Connected to PostgreSQL.\n")
        except Exception as e:
            print(f"ERROR: Cannot connect to PostgreSQL: {e}")
            print("Make sure PostgreSQL is running and config/database.yaml is correct.")
            return 1

    try:
        # Phase 1: Schema
        if not args.skip_schema:
            print("--- Schema ---")
            if not _migrate_schema(pg_conn, args.dry_run):
                return 1

        # Phase 2: wiki_pages
        if "wiki" in args.tables:
            print("\n--- Wiki Pages ---")
            if SQLITE_DB.exists():
                sconn = sqlite3.connect(str(SQLITE_DB))
                _migrate_wiki_pages(sconn, pg_conn, args.dry_run)
                sconn.close()
            else:
                print(f"  SQLite DB not found at {SQLITE_DB} — skipping.")

        # Phase 3: embeddings
        if "embeddings" in args.tables:
            print("\n--- Embeddings ---")
            if SQLITE_DB.exists():
                sconn = sqlite3.connect(str(SQLITE_DB))
                _migrate_embeddings(sconn, pg_conn, args.dry_run)
                sconn.close()
            else:
                print("  No embeddings DB — skipping.")

        # Phase 4: pipeline state
        if "pipeline" in args.tables:
            print("\n--- Pipeline State ---")
            _migrate_pipeline_state(args.dry_run)

        # Phase 5: scheduler
        if "scheduler" in args.tables:
            print("\n--- Scheduler Jobs ---")
            if pg_conn:
                _migrate_scheduler(SQLITE_SCHEDULER, pg_conn, args.dry_run)
            else:
                print(f"[DRY] Would migrate scheduler jobs from {SQLITE_SCHEDULER}")

        # Phase 6: analytics
        if "analytics" in args.tables:
            print("\n--- Search Analytics ---")
            if pg_conn:
                _migrate_analytics(SQLITE_ANALYTICS, pg_conn, args.dry_run)
            else:
                print(f"[DRY] Would migrate analytics from {SQLITE_ANALYTICS}")

        # Verify
        if not args.dry_run:
            print("\n--- Verification ---")
            report = _verify_migration(config)
            all_ok = True
            for table, info in report["tables"].items():
                status = "OK" if info["ok"] else "MISMATCH"
                print(f"  {table}: SQLite={info.get('sqlite','?')}, PG={info.get('pg','?')} [{status}]")
                if not info["ok"]:
                    all_ok = False
            if not all_ok:
                print("\nWARNING: Some tables have fewer rows in PG than SQLite.")
                print("This may be normal if some rows failed to insert (e.g. bad embeddings).")

    finally:
        if pg_conn:
            pg_conn.close()

    elapsed = time.time() - t0
    print(f"\n{'='*60}")
    print(f"Migration {'validated' if args.dry_run else 'completed'} in {elapsed:.1f}s")
    print(f"{'='*60}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
