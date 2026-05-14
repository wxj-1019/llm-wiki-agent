---
title: "Severity"
type: entity
tags: [typescript, type, alert]
sources: [notification-store-zustand-manager]
last_updated: 2026-05-14
---

# Severity

`Severity` is a TypeScript union type `'info' | 'success' | 'warning' | 'critical'` used by the alert system in [[useNotificationStore]]. It determines the visual severity level of persistent alert banners added via `addAlert`. `'critical'` severity maps to `NotificationType.error`, `'warning'` maps to `info`, and others map directly.
