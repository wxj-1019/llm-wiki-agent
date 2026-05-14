---
title: "PollingWithETag"
type: concept
tags: [pattern, polling, caching]
sources: [wikistore-zustand-global-state-store]
last_updated: 2026-05-14
---

PollingWithETag is an efficient polling pattern where the client stores the last known [[ETag]] value. On each poll, it fetches only the ETag (lightweight request). If the ETag has changed, it then downloads the full graph data. This avoids re-downloading unchanged data on every poll.

## Related Patterns
- [[ExponentialBackoff]] — used alongside for resilience
- [[LRUCache]] — page cache in [[WikiStore]]

## Used By
- [[WikiStore]]