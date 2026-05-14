---
title: "Search Backend Abstraction Layer"
type: source
tags: [search, backend, abstraction, sqlite, postgresql]
date: 2026-05-14
source_file: raw/search_backend.py
---

## Summary

Defines a pluggable `SearchBackend` interface so the wiki can use either [[SQLite]] FTS5 or [[PostgreSQL]] + [[pgvector]] without callers knowing which backend is active. Provides a singleton factory `get_search_backend()` that reads `config/database.yaml` to determine backend type, and a `reset_backend()` for testing.

## Key Claims

- **Pluggable interface**: `SearchBackend` abstract base class defines `search()`, `index_page()`, `update_page()`, `remove_page()`, `rebuild_index()`, `count()`, `close()` — plus optional `rebuild_embeddings()` and `search_semantic()`.
- **Config-driven backend selection**: `get_search_backend()` reads `config/database.yaml` → `database.backend` field. Defaults to [[SQLite]] (`WikiSearchEngine`). Supports [[PostgreSQL]] via `PgSearchBackend`.
- **Thread-safe singleton**: Uses a lock to ensure only one backend instance is created, preventing double initialization.
- **Graceful fallback**: If config file is missing or YAML parsing fails, falls back to [[SQLite]] without crashing.
- **Factory pattern**: Encapsulates backend instantiation logic, making it easy to add new backends in the future.

## Key Quotes

> "Defines a pluggable SearchBackend interface so the wiki can use either SQLite FTS5 or PostgreSQL + pgvector without callers knowing which backend is active."

> "Falls back to SQLite if config is missing or backend is unavailable."

## Connections

- [[WikiSearchEngine]] — current SQLite FTS5 implementation
- [[PgSearchBackend]] — PostgreSQL + pgvector implementation (Phase 3)
- [[config/database.yaml]] — configuration file that determines active backend
- [[SearchBackend]] — the abstract interface
- [[DatabaseAbstraction]] — related pattern for database abstraction

## Contradictions

None.