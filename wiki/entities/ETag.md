---
title: "ETag"
type: entity
tags: [backend, caching, http]
sources: [wikistore-zustand-global-state-store]
last_updated: 2026-05-14
---

HTTP ETag (Entity Tag) header used for change detection. The [[WikiStore]] polling loop fetches the index ETag via `fetchIndexEtag()` and compares it to the last known value. A mismatch triggers a graph data refresh. This pattern enables efficient polling without re-downloading unchanged data.