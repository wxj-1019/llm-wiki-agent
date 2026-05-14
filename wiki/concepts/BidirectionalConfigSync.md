---
title: "BidirectionalConfigSync"
type: concept
tags: [architecture, config, sync]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

**BidirectionalConfigSync** is the architectural pattern used by [[useConfigStore]] to keep frontend configuration state in sync with backend YAML config files. The frontend store generates YAML strings from its typed state and POSTs them to backend endpoints (`/api/config/github_sources`, `/api/config/rss_sources`, `/api/config/arxiv_sources`), and conversely fetches and parses YAML from those same endpoints to restore state. This enables the wiki viewer frontend to act as a configuration management interface for the automation pipeline.

### Related
- [[useConfigStore]] — implements this pattern
- [[SystemConfig]] — the data structure being synced
- [[fetchWithRetry]] — the HTTP client used for sync
