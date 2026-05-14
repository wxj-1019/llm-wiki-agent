---
title: "RequestDeduplication"
type: concept
tags: [pattern, optimization, networking]
sources: [data-service-dataservicets]
last_updated: 2026-05-14
---

Request deduplication is a pattern where multiple concurrent calls to the same endpoint are collapsed into a single in-flight request to avoid redundant network traffic. In [[data-service-dataservicets|dataService.ts]], this is implemented via a `Map<string, Promise<unknown>>` cache (`inFlight`) with the `dedupe()` function. The cache is cleaned up on promise resolution or rejection. This pattern is applied to `fetchGraphData`, `fetchRawFiles`, `fetchRawFileContent`, `fetchLog`, and all `use*` React Query hooks.

## When to use
- For idempotent GET endpoints where stale data is acceptable within a request batch
- Avoid for POST/PUT/DELETE mutations or endpoints that should not be cached