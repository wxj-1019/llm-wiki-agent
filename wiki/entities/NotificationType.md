---
title: "NotificationType"
type: entity
tags: [typescript, type, notification]
sources: [notification-store-zustand-manager]
last_updated: 2026-05-14
---

# NotificationType

`NotificationType` is a TypeScript union type defined in `notificationStore.ts` with the values `'success' | 'error' | 'info' | 'progress'`. It controls visual styling and behavior of notifications and toasts in the [[useNotificationStore]]. The `'progress'` type causes special handling: progress toasts replace existing progress toasts in the queue and never auto-dismiss.
