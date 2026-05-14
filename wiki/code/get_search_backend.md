---
title: "get_search_backend"
type: code_func
tags: [search, factory, singleton]
sources: [search-backend-abstraction-layer]
last_updated: 2026-05-14
---

## Signature

`def get_search_backend(config_path: Path | None = None) -> SearchBackend`

## Purpose

Thread-safe singleton factory for the wiki search backend.

## Parameters

- `config_path: Path | None` — Optional custom config path. Defaults to `<repo_root>/config/database.yaml`.

## Returns

`SearchBackend` instance — either [[WikiSearchEngine]] (SQLite) or [[PgSearchBackend]] (PostgreSQL).

## Behavior

1. Checks existing singleton; returns if set.
2. Acquires lock; double-checks singleton.
3. Reads `database.yaml` for backend type.
4. Falls back to SQLite if config missing/errored.
5. Returns appropriate implementation.

## Related

- [[SearchBackend]] — abstract interface
- [[WikiSearchEngine]] — SQLite implementation
- [[PgSearchBackend]] — PostgreSQL implementation
- [[reset_backend]] — test helper