---
title: "useIngestStream — Ingest Job SSE Stream Consumer Hook"
type: source
tags: [frontend, typescript, react, hook, sse, ingest, job]
date: 2026-05-14
source_file: useIngestStream.ts
---

## Summary
The `useIngestStream` module (`useIngestStream.ts`) provides an SSE-based job stream consumer for the [[LLMWikiViewer]] frontend. It connects to the `/api/ingest/stream` endpoint, listens for named SSE events (`start`, `log`, `stderr`, `complete`), and dispatches progress updates to the [[useIngestStore]] Zustand store. It also provides a [[React]] `useIngestStreamManager` hook for automatic lifecycle management of active connections.

## Key Claims
- **Global connection registry**: Uses a module-level `activeConnections` [[Map]] to track active [[EventSource]] instances by `jobId`. Prevents duplicate connections for the same job.
- **Named SSE event handlers**: Registers four event listeners: `start` (sets status to `running`, logs "Connected, starting ingest..."), `log` (parses `{text, progress}` JSON, appends to job logs array), `stderr` (parses `{text}` JSON, appends with `"stderr: "` prefix), and `complete` (parses `{status, returncode}` JSON, closes [[EventSource]], removes from registry, marks job as completed with final progress 100).
- **SSE error handling**: `onerror` handler closes the [[EventSource]], removes from registry, and marks the job as `failed` if it was in `running` status.
- **`disconnectIngestStream(jobId)`**: Manually closes and removes an [[EventSource]] for a given `jobId`, enabling external abort/cancel.
- **`useIngestStreamManager` hook**: Subscribes to `useIngestStore.jobs`, auto-connects streams for any job in `running` status that doesn't already have an active connection. Returns `{connect, disconnect}` for manual control. Cleans up all connections owned by the hook on unmount.

## Key Quotes
> "Uses a module-level `activeConnections` Map to track active EventSource instances by jobId" — ensures singleton connections per job
> "connectIngestStream sets status to 'running', logs 'Connected, starting ingest...'" — clear lifecycle visibility
> "Parses SSE events: start, log, stderr, complete with JSON payloads" — structured protocol for ingest job status

## Connections
- [[useIngestStore]] — state management for job status, logs, and progress
- [[IngestionJobManager]] — backend job management that emits these SSE events
- [[SSEStreamProtocol]] — common SSE event pattern used across the codebase
- [[EventSource]] — browser-native SSE consumer API
- [[LLMWikiViewer]] — the frontend this hook serves

## Contradictions
- None identified.
