---
title: "useConfigStore"
type: entity
tags: [zustand, store, config]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

**useConfigStore** is a Zustand store hook that manages the wiki automation pipeline configuration on the frontend. It provides full CRUD for [[SystemConfig]] fields with local persistence via `safeGet`/`safeSet` and deep merge with defaults, bidirectional YAML sync with backend config files via the API server, and health check on `/api/health`.

### Key Methods
- `setConfig(partial)`, `updateGithub(partial)`, `updateTrending(partial)` — partial state updates with deep merge
- `setRssFeeds(feeds)`, `setArxivQueries(queries)`, `setArchiveTtl(days)` — setter methods for specific subsections
- `checkApi()` — health check on `/api/health`
- `saveToServer() / loadFromServer()` — async backend sync via YAML generation/parsing

### Related
- [[SystemConfig]] — the configuration type managed by this store
- [[deepMerge]] — recursive merge utility used for state updates
- [[SafeJson]] — safe localStorage persistence
- [[fetchWithRetry]] — HTTP client with retry logic
