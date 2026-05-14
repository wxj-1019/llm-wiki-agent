---
title: "ToastThrottling"
type: entity
tags: [pattern, throttling, notification]
sources: [notification-store-zustand-manager]
last_updated: 2026-05-14
---

# ToastThrottling

`ToastThrottling` is a 300ms debounce mechanism in [[useNotificationStore]]. When `addNotification` is called more than once within 300ms (for non-progress types), the entry is still added to the `notifications` history list but the toast UI pop-up is suppressed to prevent notification spam. Progress-type notifications bypass this throttle.
