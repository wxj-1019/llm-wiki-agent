---
title: "AlertDeduplicationBySource"
type: concept
tags: [pattern, deduplication, alert]
sources: [notification-store-zustand-manager]
last_updated: 2026-05-14
---

# AlertDeduplicationBySource

Alert Deduplication by Source is a pattern where persistent alert banners are deduplicated by their `source` identifier. When a new alert with source "X" is created via `addAlert`, any existing active alert with the same source "X" is automatically replaced. This prevents duplicate SSE-driven banner spam — for example, if the backend emits multiple "connection_lost" events for the same data source, only the latest alert remains visible. Implemented in [[useNotificationStore]].
