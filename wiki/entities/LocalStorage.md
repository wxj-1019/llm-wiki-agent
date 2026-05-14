---
title: "LocalStorage"
type: entity
tags: []
sources: [ingest-job-store-zustand-manager]
last_updated: 2026-05-14
---

# LocalStorage

**LocalStorage** is the browser's `localStorage` API used by [[useIngestStore]] for persisting [[IngestJob]] state across page navigations. The store reads from key `wiki-ingest-jobs` on initialization, applying crash recovery for any jobs left in `running` status, and writes on every mutation.

## Connections
- [[useIngestStore]] — uses [[LocalStorage]] for persistence
- [[IngestJob]] — the persisted data type