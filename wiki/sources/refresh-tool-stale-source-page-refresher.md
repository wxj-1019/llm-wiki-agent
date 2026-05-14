---
title: "Refresh Tool — Stale Source Page Refresher"
type: source
tags: [refresh, maintenance, stale, cache]
date: 2026-05-14
source_file: tools/refresh.py
---

## Summary

The `refresh.py` script detects and re-ingests stale wiki source pages by comparing SHA256 hashes of raw documents against a persistent cache (`graph/.refresh_cache.json`). It supports force re-ingest of all sources, single-page refresh via `--page`, and dry-run preview. When a raw document has changed, it calls `ingest.py` via subprocess to update the corresponding `wiki/sources/` page with accurate facts.

## Key Claims

- **Hash-based change detection**: Computes SHA256 (first 16 hex chars) of raw document content and compares against cached hash. Only re-ingests when hash differs or `--force` is used.
- **Persistent refresh cache**: Stored in `graph/.refresh_cache.json` mapping raw document paths to their last-known SHA256 hashes. Gracefully handles corrupt/missing cache files.
- **Single-page refresh**: `--page sources/X` targets a specific wiki source page, extracting its `source_file:` frontmatter and resolving it to a raw document path.
- **Path safety**: Resolves raw paths to absolute form and verifies they stay within the project root using `path.relative_to()`, rejecting out-of-bounds paths with a warning.
- **Subprocess-based re-ingest**: Calls `python tools/ingest.py <raw_path>` as a subprocess, capturing stdout/stderr, with a 300-second timeout and structured error handling.
- **Structured logging**: All operations logged via Python logging with semantic fields (wiki_page, raw_path, returncode, error_type) for observability.

## Key Quotes

> "Refresh stale source pages by re-ingesting from raw documents."

> "Compares raw document hashes against stored hashes to detect changes."

## Connections

- [[IngestTool]] — `ingest.py` is called by `refresh_page()` to perform the actual re-ingestion
- [[BuildGraphTool]] — shares `graph/.refresh_cache.json` as a cache location convention
- [[RefreshMonitor]] — related automation for checking upstream changes via HEAD/ETag
- [[Sha256]] — hash algorithm used for change detection
- [[WikiSourcePage]] — the type of page being refreshed

## Contradictions

None.