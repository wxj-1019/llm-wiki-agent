---
title: "EventSource"
type: entity
tags: [browser-api, sse, events]
sources: [useingeststream-ingest-job-sse-stream-consumer-hook, useeventstream-sse-eventstream-consumer-hook]
last_updated: 2026-05-14
---

# EventSource

`EventSource` is a browser-native Web API for consuming [[SSEStreamProtocol|Server-Sent Events]] (SSE) streams. It is used in the [[LLMWikiViewer]] frontend in both `useIngestStream` (for ingest job status) and `useEventStream` (for system events).

In `useIngestStream`, `EventSource` instances are tracked in a module-level `activeConnections` [[Map]] keyed by `jobId`, ensuring singleton connections per job. Named events (`start`, `log`, `stderr`, `complete`) are registered via `es.addEventListener()`, and the `onerror` callback handles connection failures.