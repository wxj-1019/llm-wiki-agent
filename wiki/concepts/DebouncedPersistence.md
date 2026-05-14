---
title: "DebouncedPersistence"
type: concept
tags: [pattern, persistence, performance]
sources: [wikistore-zustand-global-state-store]
last_updated: 2026-05-14
---

DebouncedPersistence is a pattern that delays writing state changes to persistent storage ([[LocalStorage]]) by a configurable delay (500ms in [[WikiStore]]) to avoid blocking the main thread during rapid state updates (e.g., scrolling through an article updates `readingProgress` ~100 times). A `beforeunload` handler forces an immediate flush on page unload.

## Related Concepts
- [[DebouncePattern]]
- [[LocalStorage]]
- [[DebouncedPersistence]]

## Used By
- [[WikiStore]]