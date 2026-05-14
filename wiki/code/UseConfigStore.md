---
title: "UseConfigStore"
type: code_module
tags: [typescript, zustand, store, config]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

# UseConfigStore

Zustand store module in `configStore.ts` — configuration state management for wiki automation pipeline.

## Signature

```typescript
export const useConfigStore = create<ConfigState>((set, get) => ({ ... }));
```

## State
- `config: SystemConfig` — the full configuration object, persisted to localStorage
- `apiAvailable: boolean | null` — backend API health status (`null` = uncheck, `true` = up, `false` = down)

## Methods

### `setConfig(partial: Partial<SystemConfig>)`
Deep merges partial into current config, persists to localStorage.

### `updateGithub(partial: Partial<SystemConfig['github']>)`
Shallow-merges partial into `config.github`, persists.

### `updateTrending(partial: Partial<SystemConfig['github']['trending']>)`
Shallow-merges partial into `config.github.trending`, persists.

### `setRssFeeds(feeds: RSSFeed[])`
Sets `config.rss.feeds`, persists.

### `setArxivQueries(queries: ArxivQuery[])`
Sets `config.arxiv.queries`, persists.

### `setArchiveTtl(days: number)`
Sets `config.archive.default_ttl_days`, persists.

### `async checkApi()`
Pings `/api/health` with `fetchWithRetry`, sets `apiAvailable` to success or failure.

### `async saveToServer()`
Generates YAML for GitHub, RSS, arXiv config via helper functions and POSTs to the three backend config endpoints concurrently. Returns `true` only if all three succeed.

### `async loadFromServer()`
Fetches YAML from the three backend config endpoints, parses each, merges into current config if parsing succeeds. Returns `boolean`.

## Related
- [[SystemConfig]] — the configuration type
- [[deepMerge]] — used internally for updates
- [[SafeJson]] — used for local persistence
- [[fetchWithRetry]] — used for HTTP calls
- [[BidirectionalConfigSync]] — the architectural pattern
- [[ConfigPersistencePattern]] — the persistence strategy
