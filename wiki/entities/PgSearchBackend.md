---
title: "PgSearchBackend"
type: entity
tags: [search, backend, postgresql, pgvector]
sources: [pg-search-backend-postgresql-pgvector-search-backend]
last_updated: 2026-05-14
---

**PgSearchBackend** is a [[PostgreSQL]] + [[pgvector]] implementation of the [[SearchBackend]] interface. It provides synchronous full-text search via `websearch_to_tsquery()`, hybrid (FTS + vector) search, CJK-aware tokenization via zhparser or bigram fallback, "did you mean" suggestions via `pg_trgm`, type-aware ranking boosts, and analytics logging. Uses [[Psycopg2]] `ThreadedConnectionPool`.

## Connections
- [[SearchBackend]] — abstract interface implemented
- [[WikiSearchEngine]] — SQLite FTS5 sibling implementation
- [[PostgreSQL]] — underlying database
- [[pgvector]] — vector extension for embeddings
- [[Ollama]] — local LLM for generating embeddings
- [[DatabaseAbstraction]] — related design pattern
- [[search-backend-abstraction-layer]] — the abstraction design
