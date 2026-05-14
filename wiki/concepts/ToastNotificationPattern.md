---
title: "ToastNotificationPattern"
type: concept
tags: [frontend, react, hook, notification, pattern]
sources: [usetoast-toast-notification-hook]
last_updated: 2026-05-14
---

# Toast Notification Pattern

A lightweight, non-blocking notification pattern for ephemeral user feedback. Toasts auto-dismiss after a short timeout and typically appear in a fixed corner of the viewport. In the [[LLMWikiViewer]] frontend, [[useToast]] implements this pattern with a progress bar timer, pause-on-hover, and manual dismissal.

## Key Characteristics
- **Auto-dismiss**: Typical lifetime of 2–5 seconds
- **Pause-on-hover**: Stops the dismiss timer when the user hovers over the toast
- **Type-based styling**: Success (green), Error (red), Info (blue) variants
- **Manual removal**: User can dismiss a toast before the timer expires

## Connections
- [[useToast]] — hook implementation
- [[NotificationDropdown]] — persistent alternative for notification display
