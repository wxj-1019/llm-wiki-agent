---
title: "get_search_backend"
type: entity
tags: [search, factory, singleton]
sources: [search-backend-abstraction-layer]
last_updated: 2026-05-14
---

Thread-safe singleton factory function that reads `config/database.yaml` to determine and instantiate the appropriate [[SearchBackend]]. Defaults to [[WikiSearchEngine]] (SQLite) if config is missing or backend type unknown.