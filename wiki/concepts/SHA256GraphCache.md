---
title: "SHA256 Graph Cache"
type: concept
tags: [graph, cache, performance, incremental]
sources: [build-graph-tool-knowledge-graph-builder]
last_updated: 2026-05-14
---

## Summary

The SHA256 graph cache is the caching mechanism used by the [[BuildGraphTool|Build Graph Tool]] to enable incremental builds. Each wiki page's content is hashed (via the first 16 hex characters of SHA256), and if the hash matches the stored value in `.cache.json`, the page is skipped during re-parsing. Only pages whose content has changed are re-processed, dramatically accelerating subsequent builds. The cache is checked at startup and updated after each successful build.

## Connections

- [[BuildGraphTool]] — implements the SHA256 caching mechanism
- [[IncrementalBuild]] — the broader concept of partial rebuilds
- [[CacheJSON]] — the cache file stored at `graph/.cache.json`