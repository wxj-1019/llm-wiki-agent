---
title: "SearchBackend"
type: entity
tags: [search, backend, abstraction]
sources: [search-backend-abstraction-layer]
last_updated: 2026-05-14
---

Abstract base class defining the pluggable search interface for the LLM Wiki. Provides `search()`, `index_page()`, `update_page()`, `remove_page()`, `rebuild_index()`, `count()`, `close()` — plus optional `rebuild_embeddings()` and `search_semantic()`. Implemented by [[WikiSearchEngine]] (SQLite FTS5) and [[PgSearchBackend]] (PostgreSQL+pgvector). Factory function `get_search_backend()` reads [[config/database.yaml]] to select backend.