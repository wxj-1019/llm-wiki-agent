---
title: "ToastThrottlePattern"
type: concept
tags: [frontend, notification, throttling, ux]
sources: [notification-store-zustand-notification-store]
last_updated: 2026-05-14
---

A UI pattern that prevents toast notification storms by enforcing a minimum time gap between consecutive toast displays. Implemented in [[useNotificationStore]] with `TOAST_THROTTLE_MS = 300`.

## Behavior
- Rapid-fire `addNotification` calls (within 300ms of last toast) skip toast UI entirely but still log to `notifications[]` history
- Progress notifications bypass throttling to ensure real-time feedback
- Prevents screen clutter during bursty events (e.g., batch ingest feedback)

## Related
- [[DebouncePattern]] — similar rate-limiting concept but with trailing execution
- [[SSEEventStreamPattern]] — generates bursty events that benefit from this throttle
