---
title: "PgSearchBackend"
type: code_class
tags: [search, backend, postgresql, pgvector, python]
sources: [pg-search-backend-postgresql-pgvector-search-backend]
last_updated: 2026-05-14
---

## Class: `PgSearchBackend(SearchBackend)`

**File:** `tools/shared/pg_search_backend.py`

### Purpose

Implements the [[SearchBackend]] abstract interface using [[PostgreSQL]] + [[pgvector]]. Provides synchronous full-text search, hybrid search combining FTS with vector embeddings, CJK-aware tokenization, "did you mean" suggestions, type-based ranking boosts, analytics logging, and index/embedding lifecycle management.

### Constructor

```python
__init__(self, config: dict[str, Any]) -> None
```

Reads database connection parameters from the config dict (host, port, dbname, user, password, sslmode, pool sizes, vector dim, FTS/vector weights, CJK parser mode). Initializes a `psycopg2.pool.ThreadedConnectionPool`. Detects whether zhparser (`zh_cfg`) is available on the PostgreSQL server.

### Key Methods

#### `search(query: str, limit: int = 20, semantic: bool = False) -> dict[str, Any]`
Main search entry point. If `semantic=True`, calls `_hybrid_search`; otherwise calls `_fts_search`. If FTS returns zero results and query length >= 2, attempts "did you mean" suggestion via `_suggest` and re-runs FTS. Records analytics on completion. Returns `{"results": [...], "count": N, "did_you_mean": str|None, "degraded": False}`.

#### `_fts_search(conn, query: str, limit: int) -> list[dict]`
Constructs a `websearch_to_tsquery()` full-text search query. Selects text search config based on zhparser availability and CJK tokenization strategy. Returns rows with path/title/type/rank/excerpt/updated_at.

#### `_hybrid_search(conn, query: str, limit: int) -> list[dict]`
Runs FTS and vector searches in parallel, normalizes scores, combines with configurable weights (0.6 FTS / 0.4 vector default), sorts by combined score, and returns the top results.

#### `_apply_ranking_boosts(results: list[dict], query: str) -> list[dict]`
Applies type-based boosts (entity 1.2×, concept 1.1×, synthesis 1.05×, source 1.0×) and keyword-level Levenshtein matching (+10% if page title contains query).

#### `_suggest(query: str) -> str | None`
Uses `pg_trgm` extension on `wiki_pages.path` to find the most similar path to the query. Returns the suggested term or None.

#### `index_page(path: str, title: str, content: str, page_type: str, tags: list[str] | None = None) -> None`
Upserts a wiki page into `wiki_pages` table (path as unique key). Computes `tsvector` body column. If embedding exists, also updates `wiki_embeddings`. Uses try/except with explicit `conn.rollback()` on failure.

#### `remove_page(path: str) -> None`
Deletes from both `wiki_pages` and `wiki_embeddings` tables.

#### `rebuild_index() -> None`
Reads all `.md` files from `wiki/`, strips frontmatter, inserts/updates into `wiki_pages` with computed `tsvector`. Then calls `rebuild_embeddings()` to regenerate vector embeddings.

#### `rebuild_embeddings() -> None`
Reads pages, batches call to [[Ollama]] batch embed model (`nomic-embed-text`), falls back to single embed on batch failure, stores results in `wiki_embeddings` as `halfvec`. Skips meta files.

### Connections
- [[SearchBackend]] — abstract base class
- [[WikiSearchEngine]] — sibling SQLite implementation
- [[Psycopg2]] — database driver
- [[pgvector]] — vector extension
- [[Ollama]] — embedding generation
- [[DatabaseAbstraction]] — design pattern
- [[config/database.yaml]] — configuration file
