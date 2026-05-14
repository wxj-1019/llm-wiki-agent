---
title: "useNotificationStore"
type: entity
tags: [zustand, store, notification, frontend]
sources: [notification-store-zustand-manager]
last_updated: 2026-05-14
---

# useNotificationStore

`useNotificationStore` is a [[Zustand]] state management store for the [[LLMWikiViewer]] frontend that manages:
- A persistent `notifications` list (capped at 50 entries)
- A transient `toasts` queue (capped at 5 entries)
- Persistent alert banners with deduplication by `source`

Key features include toast throttling (300ms), progress notification support with `updateProgress`, 4-second auto-dismiss timers for non-progress toasts, and `addAlert` for severity-tagged, source-deduplicated persistent banners.

Used by [[Header]] and [[NotificationDropdown]] for the notification bell UI, and by [[useEventStream]] for routing SSE-driven alert banners.
