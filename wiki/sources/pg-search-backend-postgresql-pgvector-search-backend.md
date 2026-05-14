---
title: "PgSearchBackend — PostgreSQL + pgvector Search Backend"
type: source
tags: [search, backend, postgresql, pgvector, vector-search, hybrid-search]
date: 2026-05-14
source_file: tools/shared/pg_search_backend.py
---

## Summary

The `PgSearchBackend` is a PostgreSQL + pgvector implementation of the [[SearchBackend]] interface, providing synchronous FTS5-style full-text search, optional hybrid (FTS + vector) search, CJK-aware tokenization via zhparser or bigram fallback, "did you mean" query suggestion, ranking boosts by page type, analytics logging, and a full lifecycle of index/embedding management. It uses [[Psycopg2]] connection pooling for concurrent access.

## Key Claims

- **Full-text search via PostgreSQL `tsvector`**: Uses `websearch_to_tsquery()` with configurable text search configuration (`zh_cfg` if zhparser available, otherwise `simple`). CJK text is tokenized via bigram if zhparser is unavailable and `cjk_parser` is set to `auto` or `bigram_app`.
- **Hybrid (FTS + vector) search**: `_hybrid_search` runs both FTS and vector (via [[pgvector]] `halfvec`) searches in parallel, normalizes scores, and combines them with configurable weights (`fts_weight` / `vector_weight`, default 0.6/0.4).
- **Ranking boosts by page type**: `_apply_ranking_boosts` applies type-based multipliers (entities 1.2×, concepts 1.1×, syntheses 1.05×, sources 1.0×). It also uses Levenshtein distance to match keyword-level boosts (page title contains query → +10% rank).
- **"Did you mean" suggestions**: When FTS returns zero results and query length ≥ 2, `_suggest` generates a trigram-based similarity suggestion using `pg_trgm`. If the suggestion differs from the original query, a second FTS search is run with the suggested text.
- **Analytics logging**: `_record_analytics` inserts into an `analytics.search_log` table (query, result count, search type, latency in ms, did-you-mean suggestion, and timestamp). This function is wrapped in a try/except with a 50ms timeout guard — if analytics insertion fails, the search result is still returned without error.
- **Connection pooling**: Uses `psycopg2.pool.ThreadedConnectionPool` with configurable `pool_min` (default 2) and `pool_max` (default 10).
- **Index management**: `index_page` (upsert by path), `remove_page` (delete by path), `rebuild_index` (reads all wiki `.md` files, strips frontmatter, inserts into `wiki_pages` with `tsvector` body column, and calls `rebuild_embeddings`). All write operations use try/except with explicit `rollback()` on failure.
- **Embedding rebuild**: `rebuild_embeddings` batches pages, calls [[Ollama]] batch embed (with single-embed fallback), and upserts into `wiki_embeddings` table using `halfvec` type. Skips meta files (`index.md`, `log.md`, etc.).

## Key Quotes

> "If zhparser is unavailable and cjk_parser is bigram_app, tokenize CJK" — CJK awareness in FTS search
> "All write operations use try/except with explicit rollback on failure" — resilience pattern
> "Analytics logging failure does not affect search results being returned" — graceful degradation

## Connections

- [[SearchBackend]] — the abstract interface this backend implements
- [[WikiSearchEngine]] — the [[SQLite]] FTS5 sibling backend
- [[PostgreSQL]] — underlying database
- [[pgvector]] — vector extension for semantic search
- [[Ollama]] — local LLM for embeddings (nomic-embed-text)
- [[DatabaseAbstraction]] — related pattern
- [[search-backend-abstraction-layer]] — sibling source for the abstraction interface
- [[config/database.yaml]] — configuration file for backend selection

## Contradictions

None.