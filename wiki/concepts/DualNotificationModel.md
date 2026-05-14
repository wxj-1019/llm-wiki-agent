---
title: "DualNotificationModel"
type: concept
tags: [architecture, pattern, notification]
sources: [notification-store-zustand-manager]
last_updated: 2026-05-14
---

# DualNotificationModel

The Dual Notification Model separates UI notifications into two tracks: a persistent `notifications` history list (capped at 50 entries) for review, and a transient `toasts` queue (capped at 5 entries) for immediate pop-ups. [[useNotificationStore]] implements this pattern. History entries survive page navigation; toasts auto-dismiss after 4 seconds. Progress-type toasts are an exception — they replace existing progress toasts and remain visible until completed or dismissed.
