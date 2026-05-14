---
title: "WikiStore"
type: entity
tags: [frontend, zustand, state, store]
sources: [wikistore-zustand-global-state-store]
last_updated: 2026-05-14
---

`useWikiStore` is the global Zustand store for the LLM Wiki Viewer frontend, managing application-wide state including graph data, theme, sidebar, page cache, reading progress, favorites, and API connectivity.

## Key Properties
- `graphData` — the [[GraphData]] for the knowledge graph
- `theme` — 'light' | 'dark' | 'system'
- `apiConnected`, `isOffline` — connectivity flags
- `pageCache` — LRU cache of page content (100 entries, 5-min TTL)
- `recentPages` — LRU list of recently visited pages
- `favorites` — user's favorite pages
- `readingProgress` — per-page reading position

## Related Store Pages
- [[NotificationStore]] — notification and toast management
- [[IngestJobStore]] — ingest job lifecycle
- [[SystemConfigStore]] — automation pipeline configuration
- [[AgentChatStore]] — agent execution state