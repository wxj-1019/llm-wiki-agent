---
title: "ConfigPersistencePattern"
type: concept
tags: [architecture, persistence, config]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

**ConfigPersistencePattern** describes the dual-layer persistence strategy used by [[useConfigStore]]: (1) local persistence via `safeGet`/`safeSet` for immediate state recovery across page reloads, and (2) server-side persistence via YAML generation/parsing for long-term config storage and sync across clients. The pattern includes deep merge with defaults on load (only overriding stored keys), prototype pollution protection, and concurrent sync to multiple backend endpoints.

### Related
- [[useConfigStore]] — implements this pattern
- [[SystemConfig]] — the persisted data structure
- [[deepMerge]] — the merge utility
- [[SafeJson]] — the local storage utility
