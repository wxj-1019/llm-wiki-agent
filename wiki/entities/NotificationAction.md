---
title: "NotificationAction"
type: entity
tags: [typescript, interface, action]
sources: [notification-store-zustand-manager]
last_updated: 2026-05-14
---

# NotificationAction

`NotificationAction` is a TypeScript interface `{ label: string; handler: () => void }` used by [[useNotificationStore]] alerts. It represents an optional action button attached to a persistent alert banner, allowing users to take immediate action (e.g., "Retry", "View details") from the notification.
