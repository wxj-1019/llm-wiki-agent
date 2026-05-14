---
title: "SQLite"
type: entity
tags: [database, search, fts5, backend, sql]
sources: [overview.md, pg-search-backend-postgresql-pgvector-search-backend.md, search-backend-abstraction-layer.md, wiki-mcp-server-mcp-stdio-server.md]
---

# SQLite

SQLite appears in this wiki primarily as an alternative database backend for search functionality, alongside PostgreSQL with pgvector. The search abstraction layer defines a pluggable `SearchBackend` interface that supports both SQLite and PostgreSQL, with the specific backend selected via configuration in `config/database.yaml`. When SQLite is selected, its FTS5 (Full-Text Search version 5) extension provides synchronous full-text search capabilities as an alternative to PostgreSQL's `tsvector`-based search. This dual-backend design allows the wiki to operate in lightweight or embedded deployments without requiring a full PostgreSQL server. The SQLite-backed search backend implements the same core interface methods — `search()`, `index_page()`, `update_page()`, `remove_page()`, `rebuild_index()`, `count()`, and `close()` — ensuring consistency regardless of which database is active. Notably, SQLite lacks native pgvector-style semantic search, so hybrid (FTS + vector) search is only available when using the PostgreSQL backend.