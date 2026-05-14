---
title: "reset_backend"
type: code_func
tags: [search, testing]
sources: [search-backend-abstraction-layer]
last_updated: 2026-05-14
---

## Signature

`def reset_backend() -> None`

## Purpose

Resets the [[get_search_backend]] singleton; closes existing backend if present.

## Behavior

Acquires lock, calls `close()` on existing instance, sets singleton to `None`.

## Related

- [[get_search_backend]] — factory that creates/resets the singleton
- [[SearchBackend]] — the abstract interface