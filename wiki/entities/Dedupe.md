---
title: "Dedupe"
type: entity
tags: [typescript, pattern]
sources: [data-service-dataservicets]
last_updated: 2026-05-14
---

`dedupe<T>()` is an in-flight request cache that prevents redundant concurrent network requests to the same endpoint. It stores a `Promise<T>` keyed by a string, reuses it for concurrent callers, and cleans up on resolution/rejection. Used extensively in [[data-service-dataservicets|dataService.ts]].