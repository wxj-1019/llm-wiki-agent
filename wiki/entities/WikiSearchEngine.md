---
title: "WikiSearchEngine"
type: entity
tags: [search, sqlite, fts5]
sources: [search-backend-abstraction-layer]
last_updated: 2026-05-14
---

Current SQLite FTS5 implementation of the [[SearchBackend]] interface. Used as the default backend when `config/database.yaml` is missing or explicitly set to `sqlite`. Provides full-text search capabilities for wiki pages.