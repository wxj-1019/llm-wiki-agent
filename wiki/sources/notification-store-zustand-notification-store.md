---
title: "NotificationStore — Zustand Notification Store with Alert & Toast Management"
type: source
tags: [frontend, typescript, zustand, notification, toast, alert, state-management]
date: 2026-05-14
source_file: notificationStore.ts
---

## Summary
The `useNotificationStore` is a Zustand-based notification store managing two-tier notification delivery: toast popups (auto-dismissed, throttled) and persistent alert banners (from SSE events). Supports progress tracking, severity-based styling, action buttons, unread counts, and `@mention`-compatible source deduplication for alerts.

## Key Claims
- **Dual notification system**: Separate `notifications[]` (persistent history) and `toasts[]` (auto-dismissed overlay) arrays. `addNotification` writes to both; toasts auto-dismiss after 4 seconds unless type is `'progress'`. Alerts (`addAlert`) go only to `notifications[]` with `isAlert: true`, never to toasts.
- **Toast throttling**: `TOAST_THROTTLE_MS = 300` prevents toast storm during rapid-fire notifications. Under-throttle calls still log to `notifications[]` but skip toast UI.
- **Progress notification support**: `type: 'progress'` notifications remain as toasts indefinitely (no auto-dismiss), supporting inline progress bars via `updateProgress(id, 0-100)`. Only one progress toast at a time.
- **Alert deduplication by source**: `addAlert` replaces existing alert from the same `source` identifier, preventing duplicate persistent banners.
- **Unread tracking**: `markRead(id)`, `markAllRead()`, `unreadCount()` for notification badge display.
- **Clean timer management**: `removeNotification` and `clearNotifications` properly clear `setTimeout` timers via `toastTimers` Map to prevent memory leaks.
- **History limit**: Both arrays capped at 50 entries (notifications) and 5 entries (toasts) via `.slice(0, N)`.

## Key Quotes
> "`if (now - lastToastTime < TOAST_THROTTLE_MS && type !== 'progress') { ... return; }`" — toast throttling guard
> "`type === 'progress' ? [notification, ...state.toasts.filter((t) => t.type !== 'progress')].slice(0, 5)`" — replace existing progress toast
> "`set((state) => ({ notifications: [alert, ...state.notifications.filter((n) => !(n.isAlert && n.source === source))].slice(0, 50) }))`" — alert deduplication by source

## Connections
- [[useNotificationStore]] — the Zustand store hook
- [[Notification]] — core data interface
- [[Header]] — consumes `unreadCount()` for badge display
- [[NotificationDropdown]] — renders notification list with type/severity styling, uses `markRead`/`dismissAlert`
- [[useEventStream]] — calls `addAlert` on SSE alert events
- [[SSEEventStreamPattern]] — drives alert creation via SSE events
- [[useCountUp]] — unrelated hook, but shares animated UI pattern

## Contradictions
- None found.
