---
title: "LRUCache"
type: entity
tags: [pattern, caching, performance]
sources: [wikistore-zustand-global-state-store]
last_updated: 2026-05-14
---

Least Recently Used cache pattern. In [[WikiStore]], `pageCache` is an LRU cache with a maximum of 100 entries. When a new page is added and the cache is full, the oldest fetched entry (sorted by `fetchedAt`) is evicted.