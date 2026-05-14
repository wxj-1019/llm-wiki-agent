---
title: "Toast"
type: entity
tags: [frontend, react, hook, notification]
sources: [usetoast-toast-notification-hook]
last_updated: 2026-05-14
---

# Toast

A short-lived notification element typically used for transient feedback (success/error/info) that auto-dismisses after a few seconds. In the [[LLMWikiViewer]] frontend, [[useToast]] manages toast state with a progress bar timer, pause-on-hover, and manual removal.

## Connections
- [[useToast]] — the React hook that implements the toast management system
- [[Header]] — potential visual host for toast display
- [[NotificationDropdown]] — complementary persistent notification component
