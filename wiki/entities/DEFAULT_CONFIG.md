---
title: "DEFAULT_CONFIG"
type: entity
tags: [config, defaults]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

**DEFAULT_CONFIG** is the hardcoded default [[SystemConfig]] object in `configStore.ts`. It provides sensible initial values: GitHub trending enabled for 5 languages with 7-day window (5 repos each), a single Hacker News RSS feed for AI, an arXiv query covering cs.AI/cs.CL/cs.LG, and 90-day default archive TTL. Used as the base during `loadFromStorage` merge.

### Related
- [[useConfigStore]] — merges this into persisted config on load
- [[SystemConfig]] — the configuration type
