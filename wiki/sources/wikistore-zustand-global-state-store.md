---
title: "WikiStore — Zustand Global State Store for LLM Wiki Viewer"
type: source
tags: [frontend, typescript, zustand, state-management, graph-cache, polling, persistence]
date: 2026-05-14
source_file: wikiStore.ts
---

## Summary
The `wikiStore.ts` file defines the global [[Zustand]]-based state store (`useWikiStore`) for the LLM Wiki Viewer frontend. It manages graph data caching with TTL, polling/index change detection via ETag, theme application (light/dark/system with system preference listener), sidebar collapse state, page cache (LRU, 100 entries, 5-min TTL), recent pages (LRU), favorites, reading progress, API health heartbeat, and debounced persistence to localStorage. The store initializes from persisted state, starts a polling loop, and auto-persists on relevant field changes.

## Key Claims
- **Graph data with TTL caching**: `loadGraphCache` reads from localStorage with 1-hour TTL. `saveGraphCache` writes on successful fetch. `refreshGraphData` fetches fresh graph data and updates the cache.
- **Polling with exponential backoff**: `_schedulePoll` polls the server every 30s (base) for index changes via ETag. On failure, interval doubles (up to 5 min). After 10 consecutive failures, polling stops permanently and sets an error state.
- **Theme system with live system preference listener**: `applyTheme` sets `data-theme` on `<html>`. In "system" mode, it registers a `matchMedia` change listener that dynamically switches between dark/light. The listener is removed when leaving "system" mode to prevent memory leaks.
- **Debounced persistence**: State changes (theme, sidebar, recentPages, readingProgress, favorites) are debounced 500ms before writing to localStorage via `persistState`. A `beforeunload` handler forces an immediate flush on page unload to prevent data loss.
- **Page cache**: LRU cache of up to 100 pages, each with 5-minute TTL. `_hydratePageCache` populates from graph data on ETag change. `getCachedPage` / `setCachedPage` provide manual access.
- **Heartbeat**: 30-second interval health check (`/api/health`). After 3 consecutive failures, `isOffline` becomes true, allowing the UI to show offline state.
- **Backlinks**: `getBacklinks(nodeId)` using `getEdges` and `getNodeById` to find all nodes pointing to a given node.

## Key Quotes
> "`if (Date.now() - (parsed._cachedAt as number || 0) > GRAPH_CACHE_TTL_MS) return null;`" — graph cache TTL enforcement
> "`const effective = theme === 'system' ? getSystemTheme() : theme;`" — theme resolution logic
> "`_consecutiveFailures++; _currentPollInterval = Math.min(BASE_POLL_INTERVAL * Math.pow(2, _consecutiveFailures), MAX_POLL_INTERVAL);`" — exponential backoff for polling
> "`if (_consecutiveFailures >= MAX_FAILURES_BEFORE_STOP) { stopPolling(); ... set({ error: 'Backend server unreachable. Polling stopped.' }); }`" — polling stop on persistent failure
> "`persistState` debounces localStorage writes to 1 second" — persistence throttling

## Connections
- [[Zustand]] — the state management library used
- [[DataService]] — used for `fetchGraphData` and `fetchIndexEtag`
- [[GraphData]] — the core data type managed by this store
- [[GraphNode]] — node type in the graph
- [[ETag]] — HTTP ETag header for change detection
- [[LocalStorage]] — persistence layer
- [[SafeJson]] — safe JSON parsing for localStorage
- [[DebouncedPersistence]] — debounced writing pattern
- [[DebouncePattern]] — general debounce concept
- [[HeartbeatPolling]] — periodic API health check pattern
- [[ExponentialBackoff]] — backoff strategy for polling
- [[LRUCache]] — page cache eviction strategy

## Code
- Related source code: [[wikiStore.ts]]
- Persistence helper: [[safeStorage.ts]]
- Search initialization: [[search.ts]]
