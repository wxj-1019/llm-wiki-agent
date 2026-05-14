---
title: "DatabaseAbstraction"
type: concept
tags: [pattern, search, database]
sources: [search-backend-abstraction-layer]
last_updated: 2026-05-14
---

Design pattern where a unified interface ([[SearchBackend]]) abstracts over multiple database backends (SQLite FTS5, PostgreSQL+pgvector). Callers interact only with the interface, and backend selection is determined by configuration. Enables seamless swapping without code changes.