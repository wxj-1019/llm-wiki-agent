---
title: "System Configuration Store — Zustand Manager for Wiki Automation Config"
type: source
tags: [frontend, typescript, zustand, config, automation, pipeline]
date: 2026-05-14
source_file: configStore.ts
---

## Summary

The `useConfigStore` is a Zustand-based state management store for configuring the LLM Wiki automation pipeline from the frontend. It manages [[SystemConfig]] (GitHub trending, RSS feeds, arXiv queries, archive TTL), provides local storage persistence via `safeSet`/`safeGet` with deep merge, and syncs bidirectionally with backend YAML config files through the API server. Includes prototype pollution protection and network health checking.

## Key Claims

- **Full configuration surface**: Manages GitHub token + trending (languages, since_days, per_language), RSS feed list, arXiv query list, and default archive TTL in a single typed interface (`SystemConfig`).
- **Safe local persistence**: Uses `safeGet`/`safeSet` from `safeStorage` library for localStorage persistence with type validation (`isObject` guard on load).
- **Deep merge on load**: `loadFromStorage` merges stored config with `DEFAULT_CONFIG` via `deepMerge` — only overrides keys that exist in storage, never loses defaults. Blocks `__proto__`, `constructor`, `prototype` keys to prevent prototype pollution.
- **Immutable Zustand state updates**: All mutations (`setConfig`, `updateGithub`, `updateTrending`, `setRssFeeds`, `setArxivQueries`, `setArchiveTtl`) use `set()` with new objects, ensuring React re-renders correctly.
- **Backend sync via `saveToServer` / `loadFromServer`**: `saveToServer` builds YAML strings from current state and POSTs them to `/api/config/github_sources`, `/api/config/rss_sources`, `/api/config/arxiv_sources` concurrently. `loadFromServer` fetches the same endpoints and parses them back.
- **YAML generation (buildGithubYaml/buildRssYaml/buildArxivYaml)**: Constructs properly formatted YAML strings matching the expected config file format (with comments).
- **YAML parsing (parseGithubYaml/parseRssYaml/parseArxivYaml)**: Lightweight regex-based YAML parsers that extract structured data from the backend config files. Not a full YAML parser — uses line-by-line regex matching.
- **API health check**: Uses `fetchWithRetry` to ping `/api/health` and sets `apiAvailable` boolean for UI status indication.
- **Network resilience**: Uses `fetchWithRetry` for all HTTP calls with configurable timeout, retries, and retry delay.
- **No direct side effects**: Does not trigger actual pipeline execution — only manages configuration state.

## Key Quotes

> "`const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);`" — prototype pollution prevention
> "`if (DANGEROUS_KEYS.has(key)) continue;`" — critical guard in deepMerge
> "`const stored = safeGet('wiki-system-config', isObject, {}); return deepMerge(DEFAULT_CONFIG, stored);`" — safe persisted config load with defaults merge
> "`const [g1, g2, g3] = await Promise.all([...])`" — concurrent YAML sync to 3 backend config endpoints
> "`const nameMatch = /name:\s*"(.+)"/.exec(line);`" — regex-based YAML parsing pattern

## Connections

- [[SystemConfig]] — the core configuration data structure managed by this store
- [[useConfigStore]] — the Zustand store hook
- [[SafeJson]] — utility functions for safe localStorage access with validation guards
- [[DEFAULT_CONFIG]] — the default configuration object with sensible initial values
- [[fetchWithRetry]] — network resilience layer used by all async operations
- [[deepMerge]] — recursive merge utility with prototype pollution protection
- [[buildGithubYaml]] — generates GitHub config YAML for backend persistence
- [[parseGithubYaml]] — parses GitHub config YAML from backend
- [[buildRssYaml]] — generates RSS config YAML
- [[parseRssYaml]] — parses RSS config YAML
- [[buildArxivYaml]] — generates arXiv config YAML
- [[parseArxivYaml]] — parses arXiv config YAML

## Contradictions

- No contradictions found with existing wiki content.
