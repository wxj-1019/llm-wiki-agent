---
title: "useIngestStream"
type: code_module
tags: [frontend, typescript, react, hook, sse, ingest]
sources: [useingeststream-ingest-job-sse-stream-consumer-hook]
last_updated: 2026-05-14
---

# useIngestStream

**File:** `useIngestStream.ts`

SSE-based job stream consumer for the [[LLMWikiViewer]] frontend ingest workflow.

## Functions

### `connectIngestStream(jobId: string, path: string): void`
Connects to `/api/ingest/stream?path=<path>` via [[EventSource]]. Registers `start`, `log`, `stderr`, `complete` event listeners that dispatch updates to [[useIngestStore]]. Guards against duplicate connections via module-level `activeConnections` [[Map]].

### `disconnectIngestStream(jobId: string): void`
Manually closes and removes an [[EventSource]] for a given `jobId`.

### `useIngestStreamManager()`
[[React]] hook: subscribes to `useIngestStore.jobs`, auto-connects streams for all running jobs without active connections. Returns `{connect, disconnect}`. Cleans up owned connections on unmount.

## Imports
- `useIngestStore` from `@/stores/ingestStore` (Zustand store)

## Related
- [[SSEStreamProtocol]] — common SSE pattern
- [[useEventStream]] — similar SSE consumer for system events