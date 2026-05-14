---
title: "Notification"
type: entity
tags: [typescript, interface, notification]
sources: [notification-store-zustand-manager]
last_updated: 2026-05-14
---

# Notification

`Notification` is the core TypeScript interface representing a single notification in the [[useNotificationStore]]. It contains:
- `id: string` — unique identifier
- `message: string` — display text
- `type: NotificationType` — success/error/info/progress
- `timestamp: number` — epoch ms
- `read: boolean` — read state
- `progress?: number` — 0–100 for progress type
- `severity?: Severity` — for alert banners
- `source?: string` — origin identifier for deduplication
- `action?: NotificationAction` — optional CTA button
- `isAlert?: boolean` — true for persistent banners
