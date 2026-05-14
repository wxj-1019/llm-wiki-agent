---
title: "HeartbeatPolling"
type: entity
tags: [pattern, polling, health]
sources: [wikistore-zustand-global-state-store]
last_updated: 2026-05-14
---

HeartbeatPolling is the pattern implemented in [[WikiStore]] via `startHeartbeat()` using a 30-second interval health check to the `/api/health` endpoint. After 3 consecutive failures, `isOffline` is set to true.

Related patterns: [[ExponentialBackoff]], [[PollingWithETag]]