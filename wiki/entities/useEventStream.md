---
title: "useEventStream"
type: entity
tags: [frontend, hook, sse, events]
sources: [useeventstream-sse-eventstream-consumer-hook]
---

A React hook that connects to `/api/events` SSE endpoint and dispatches events to the [[useNotificationStore]]. Implements severity-based routing (critical/warning → persistent alerts, info/success → toasts), exponential backoff reconnection (5s→15s→30s, max 3 retries), and action button generation for relevant events. Returns a `connectionState` for UI status indicators.