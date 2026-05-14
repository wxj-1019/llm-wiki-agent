---
title: "NotificationState"
type: entity
tags: [typescript, interface, state]
sources: [notification-store-zustand-manager]
last_updated: 2026-05-14
---

# NotificationState

`NotificationState` is the TypeScript interface defining the shape of the [[useNotificationStore]] Zustand store. It includes:
- `notifications: Notification[]` — persistent history list
- `toasts: Notification[]` — transient pop-up queue
- Action methods: `addNotification`, `addAlert`, `updateProgress`, `removeNotification`, `markRead`, `markAllRead`, `clearNotifications`, `dismissToast`, `dismissAlert`
- Computed methods: `getActiveAlerts`, `unreadCount`
