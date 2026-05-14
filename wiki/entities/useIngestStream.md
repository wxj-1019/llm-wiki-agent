---
title: "useIngestStream"
type: entity
tags: [frontend, typescript, react, hook, sse]
sources: [useingeststream-ingest-job-sse-stream-consumer-hook]
last_updated: 2026-05-14
---

# useIngestStream

`useIngestStream` is a module in the [[LLMWikiViewer]] frontend that provides an SSE-based consumer for real-time ingest job status updates. It includes `connectIngestStream` (connects to `/api/ingest/stream`), `disconnectIngestStream` (manually closes connection), and `useIngestStreamManager` (a [[React]] hook for automatic lifecycle management).

It uses a module-level `activeConnections` [[Map]] to track active [[EventSource]] instances per `jobId`, and dispatches state mutations to the [[useIngestStore]] Zustand store.

Key handlers: `start`, `log`, `stderr`, `complete`, and `onerror`. Supports structured JSON payloads for `log` (`{text, progress}`), `stderr` (`{text}`), and `complete` (`{status, returncode}`).