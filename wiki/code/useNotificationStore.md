---
title: "useNotificationStore"
type: code_module
tags: [zustand, store, notification, frontend]
source_file: notificationStore.ts
last_updated: 2026-05-14
---

Zustand store hook exported from `notificationStore.ts`. Manages dual-tier notification (toast + alert) state with throttling, progress tracking, and deduplication.

## Declaration
```typescript
export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  toasts: [],
  ...methods...
}));
```

## State
- `notifications: Notification[]` — persistent notification history (cap 50)
- `toasts: Notification[]` — auto-dismissed overlay toasts (cap 5)

## Methods
### `addNotification(message, type?, progress?)`
Creates a notification in both `notifications[]` and `toasts[]`. Auto-dismisses toast after 4 seconds unless type is `'progress'`. Throttled at 300ms.

### `addAlert(message, severity, source, action?)`
Creates a persistent alert banner (only in `notifications[]`, never in toasts). Deduplicates by source — replaces existing alert from same source.

### `updateProgress(id, progress)`
Updates `progress` field on both `notifications[]` and `toasts[]` for the given ID.

### `removeNotification(id)`
Removes from both arrays, clears any pending auto-dismiss timer.

### `markRead(id)`, `markAllRead()`
Sets `read: true` on one or all notifications.

### `clearNotifications()`
Clears all timers and resets both arrays.

### `dismissToast(id)`
Removes only from `toasts[]`, clears timer.

### `dismissAlert(id)`
Removes alert from `notifications[]` (filtered by `isAlert`).

### `getActiveAlerts()`, `unreadCount()`
Selectors: returns active alerts, or count of unread notifications.

## Internal State
- `toastIdCounter` — incrementing counter for unique IDs
- `toastTimers: Map<string, Timeout>` — tracks auto-dismiss timers for cleanup
- `lastToastTime` — timestamp of last toast for throttle calculation

## Related Pages
- [[Notification]] — core interface
- [[NotificationType]] — type alias
- [[Severity]] — type alias
- [[NotificationAction]] — action button interface
- [[ToastThrottlePattern]] — concept
- [[AlertDeduplicationBySource]] — concept
