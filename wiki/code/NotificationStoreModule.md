---
title: "useNotificationStore — Zustand Notification Management Store"
type: code_module
tags: [zustand, notification, typescript, state-management]
sources: [notification-store-zustand-manager]
last_updated: 2026-05-14
---

# useNotificationStore

**File:** `notificationStore.ts`

A [[Zustand]] store managing the dual-model notification system for [[LLMWikiViewer]].

## Exported Types

### `NotificationType`
```typescript
export type NotificationType = 'success' | 'error' | 'info' | 'progress';
```

### `Severity`
```typescript
export type Severity = 'info' | 'success' | 'warning' | 'critical';
```

### `NotificationAction`
```typescript
export interface NotificationAction {
  label: string;
  handler: () => void;
}
```

### `Notification`
```typescript
export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: number;
  read: boolean;
  progress?: number;
  severity?: Severity;
  source?: string;
  action?: NotificationAction;
  isAlert?: boolean;
}
```

## Exported Hook

### `useNotificationStore`

Created via `create<NotificationState>((set, get) => ({...}))`.

**State:** `notifications: Notification[]`, `toasts: Notification[]`

**Methods:**

| Method | Signature | Purpose |
|---|---|---|
| `addNotification` | `(message, type?, progress?) => string` | Adds notification + toast (throttled). Returns ID. |
| `addAlert` | `(message, severity, source, action?) => string` | Adds persistent alert banner with dedup by source. |
| `updateProgress` | `(id, progress) => void` | Updates progress value on notification + toast. |
| `removeNotification` | `(id) => void` | Removes from both lists, clears timer. |
| `markRead` | `(id) => void` | Marks single notification as read. |
| `markAllRead` | `() => void` | Marks all notifications as read. |
| `clearNotifications` | `() => void` | Clears all timers, empties all lists. |
| `dismissToast` | `(id) => void` | Clears timer, removes from toast list only. |
| `dismissAlert` | `(id) => void` | Removes alert from notifications by ID. |
| `getActiveAlerts` | `() => Notification[]` | Returns all notifications with `isAlert: true`. |
| `unreadCount` | `() => number` | Returns count of unread notifications. |

**Internal constants:** `TOAST_THROTTLE_MS = 300`, `toastTimers: Map<string, ReturnType<typeof setTimeout>>`

## Key Patterns
- **Throttle:** Rapid `addNotification` calls within 300ms suppress toast UI but still append to history.
- **Auto-dismiss:** Non-progress toasts auto-dismiss after 4 seconds via `setTimeout`.
- **Alert dedup:** `addAlert` replaces existing alert from the same `source`.
- **Immutable updates:** All state mutations create new arrays/objects.

Related: [[Header]], [[NotificationDropdown]], [[useEventStream]], [[IngestSSEProtocol]]
