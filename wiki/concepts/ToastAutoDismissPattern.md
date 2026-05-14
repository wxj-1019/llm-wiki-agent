---
title: "ToastAutoDismissPattern"
type: concept
tags: [pattern, toast, auto-dismiss]
sources: [notification-store-zustand-manager]
last_updated: 2026-05-14
---

# ToastAutoDismissPattern

The Toast Auto-Dismiss Pattern uses a `setTimeout` (4 seconds) to automatically remove transient toast notifications from the UI. Timers are tracked in a module-level `Map<string, ReturnType<typeof setTimeout>>` (`toastTimers`) for reliable cleanup. When a toast is manually dismissed or its notification is removed, the timer is cleared to prevent stale state updates. Progress-type notifications never auto-dismiss. [[useNotificationStore]] implements this pattern.
