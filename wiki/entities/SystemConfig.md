---
title: "SystemConfig"
type: entity
tags: [typescript, interface, config]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

**SystemConfig** is the top-level TypeScript interface defining the wiki automation pipeline configuration managed by [[useConfigStore]]. It contains nested configuration for [[GitHub]] trending (token, languages, since_days, per_language), [[RSS]] feeds (name/url pairs), [[arXiv]] queries (label/query pairs), and archive default TTL (90 days default).

### Properties
- `github: { token, trending }` — GitHub access and trending settings
- `rss: { feeds[] }` — list of RSS feed configurations
- `arxiv: { queries[] }` — list of arXiv query configurations
- `archive: { default_ttl_days }` — default archive expiration in days

### Related
- [[useConfigStore]] — the Zustand store managing this config
- [[fetchWithRetry]] — used by the store for backend sync
- [[SafeJson]] — safe localStorage persistence utilities
