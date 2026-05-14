---
title: "WikiStore"
type: code_module
tags: [typescript, zustand, store]
sources: [wikistore-zustand-global-state-store]
last_updated: 2026-05-14
---

## `useWikiStore` — Global Zustand Store

**File**: `wiki-viewer/src/stores/wikiStore.ts`

### Purpose
Central global state store for the LLM Wiki Viewer frontend, managing graph data, theme, sidebar, page cache, recent pages, favorites, reading progress, API connectivity, and offline detection.

### Key State Properties
- `graphData: GraphData | null` — knowledge graph nodes and edges
- `theme: 'light' | 'dark' | 'system'` — current theme mode
- `sidebarCollapsed: boolean` — sidebar visibility
- `loading: boolean`, `error: string | null` — loading/error state
- `recentPages: string[]` — LRU list of visited page labels
- `favorites: string[]` — user's starred pages
- `readingProgress: Record<string, number>` — per-page scroll progress (0-100)
- `commandPaletteOpen: boolean` — Cmd+K palette state
- `apiConnected: boolean` — backend reachability
- `isOffline: boolean` — offline mode flag (3+ heartbeat failures)
- `pageCache: Map<string, PageCacheEntry>` — LRU cache of rendered page content

### Key Methods
- `initialize()` — load persisted state, start polling, hydrate graph cache
- `refreshGraphData()` — force re-fetch graph and update cache
- `getNodeById(id)`, `getNodeByLabel(label)`, `getBacklinks(nodeId)` — graph traversal helpers
- `addRecentPage(pageId)`, `toggleFavorite(pageId)`, `setReadingProgress(pageId, progress)` — user state mutations
- `startHeartbeat()` — 30s interval API health check

### Internal Helpers
- `applyTheme(theme)` — sets `data-theme` attribute; manages system theme listener lifecycle
- `loadGraphCache()` / `saveGraphCache(data)` — 1-hour TTL localStorage cache
- `persistState(state)` — 500ms debounced write to localStorage
- `_schedulePoll()` / `_startPolling()` — exponential backoff polling loop with ETag comparison

### Related
- [[Zustand]] — library
- [[DataService]] — API calls
- [[SafeJson]] — persistence safety
- [[DebouncedPersistence]] — write pattern