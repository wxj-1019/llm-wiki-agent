---
title: "Notification Store — Zustand State Manager for Notifications and Alerts"
type: source
tags: [frontend, typescript, zustand, notification, alert, toast, state-management]
date: 2026-05-14
source_file: notificationStore.ts
---

## Summary
The `useNotificationStore` is a Zustand-based state management store for the [[LLMWikiViewer]] frontend that manages both a historical notification list (capped at 50) and a transient toast queue (capped at 5), with throttled toast display, auto-dismiss timers (4s), progress notification support, and persistent alert banners with deduplication by source.

## Key Claims
- **Dual notification model**: Separates `notifications` (persistent history, up to 50 entries) from `toasts` (transient pop-ups, up to 5 entries). Progress-type toasts replace existing progress toasts; non-progress toasts auto-dismiss after 4 seconds.
- **Toast throttling**: `TOAST_THROTTLE_MS = 300ms` — if `addNotification` is called more than once within 300ms, the call still appends to the notifications list but skips the toast UI to prevent spam.
- **Progress notification support**: `addNotification` accepts an optional `progress` (0–100) for showing upload/download/ingest progress. A separate `updateProgress` method updates the progress field on both the notification and its corresponding toast.
- **Alert system via `addAlert`**: Creates persistent `isAlert: true` notifications that appear in the notification list but never as toasts. Alerts have `severity` (info/success/warning/critical), `source`, and optional `action` button. **Deduplication**: if a new alert shares the same `source` as an existing active alert, the old one is replaced — prevents duplicate SSE-driven banner spam.
- **Immutable Zustand updates**: All mutations use `set()` with immutable array/object creation. Timers are tracked in a module-level `toastTimers` Map and cleaned up on `clearNotifications()`.
- **Unread count**: `unreadCount()` returns the count of notifications where `read === false`. `markAllRead()` sets all to read.
- **Full lifecycle management**: `removeNotification` clears both the toast timer and the entry. `dismissToast` clears the timer and removes from the toast list only. `clearNotifications` clears all timers and empties both lists.

## Key Quotes
> "`if (now - lastToastTime < TOAST_THROTTLE_MS && type !== 'progress') { // Skip toast UI for rapid-fire notifications, but still log }`" — toast throttling prevents UI spam
> "`.slice(0, 50)`" — notification history cap at 50 entries
> "`.slice(0, 5)`" — toast queue cap at 5 entries
> "`const timer = setTimeout(() => { set(...) }, 4000); toastTimers.set(id, timer);`" — auto-dismiss after 4 seconds
> "`set(... notifications.filter((n) => !(n.isAlert && n.source === source))`" — alert deduplication by source

## Connections
- [[Header]] — consumes the notification store for the notification bell dropdown
- [[NotificationDropdown]] — the UI component that renders the notification dropdown
- [[useEventStream]] — SSE events from the backend feed alerts into this store via `addAlert`
- [[ToastNotificationPattern]] — the architectural pattern for transient toast notifications
- [[IngestSSEProtocol]] — progress notifications are driven by SSE ingest job streams
- [[LLMWikiViewer]] — the frontend application context

## Contradictions
- None identified.
