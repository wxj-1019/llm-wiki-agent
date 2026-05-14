---
title: "Incremental Graph Build"
type: concept
tags: [graph, build, performance, incremental]
sources: [build-graph-tool-knowledge-graph-builder]
last_updated: 2026-05-14
---

## Summary

Incremental graph build is a performance optimization in the [[BuildGraphTool|Build Graph Tool]] that only re-processes changed wiki pages and code files since the last build. It relies on SHA256 hash caching (`.cache.json`) to detect changes: unchanged pages are skipped entirely. When combined with `--code` flag, the `--incremental` mode extends this to source code files, tracking file modification times and hashes to avoid re-parsing unchanged `.py` and `.tsx` files. This makes the build tool practical for frequent use during development.

## Connections

- [[BuildGraphTool]] — implements incremental builds
- [[SHA256GraphCache]] — the caching mechanism underlying incremental builds
- [[CodeGraph]] — code files can also be incrementally parsed