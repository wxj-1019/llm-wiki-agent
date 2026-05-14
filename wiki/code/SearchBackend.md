---
title: "SearchBackend"
type: code_module
tags: [search, backend, abstraction]
sources: [search-backend-abstraction-layer]
last_updated: 2026-05-14
---

## Signature

`class SearchBackend(ABC)` — abstract base class in `tools/shared/search_backend.py`

## Purpose

Defines the abstract interface for wiki search backends.

## Methods

- `search(query: str, limit: int = 20, semantic: bool = False) -> dict[str, Any]` — Returns results dict with `results`, `count`, `did_you_mean`, `degraded`.
- `index_page(page_path: str, content: str) -> None` — Index/update a single page.
- `update_page(page_path: str, content: str) -> None` — Alias for `index_page()`.
- `remove_page(page_path: str) -> None` — Remove from index.
- `rebuild_index() -> None` — Drop and rebuild full index.
- `count() -> int` — Number of indexed pages.
- `close() -> None` — Release resources.
- `rebuild_embeddings() -> None` — Optional: rebuild vector embeddings.
- `search_semantic(query, limit) -> dict` — Convenience for hybrid search.

## Related

- [[WikiSearchEngine]] — SQLite FTS5 implementation
- [[PgSearchBackend]] — PostgreSQL+pgvector implementation
- [[get_search_backend]] — singleton factory
- [[DatabaseAbstraction]] — pattern documentation