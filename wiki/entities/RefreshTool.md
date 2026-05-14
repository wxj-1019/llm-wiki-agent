---
title: "RefreshTool"
type: entity
tags: [refresh, maintenance]
sources: [refresh-tool-stale-source-page-refresher]
last_updated: 2026-05-14
---

# RefreshTool

The `RefreshTool` is the wiki component responsible for detecting and refreshing stale source pages. It compares SHA256 hashes of raw documents against a persistent cache (`graph/.refresh_cache.json`) and calls [[IngestTool]] via subprocess when changes are detected.

## Key Features

- Hash-based change detection with persistent cache
- Force re-ingest (`--force`) and single-page refresh (`--page`)
- Dry-run mode for preview
- Path traversal safety with project root validation
- Structured logging with semantic fields