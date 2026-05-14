---
title: "useIngestStore"
type: code_module
tags: [zustand, typescript, frontend]
sources: [ingest-job-store-zustand-manager]
last_updated: 2026-05-14
---

# useIngestStore

`useIngestStore` is a [[Zustand]] store created via `create<IngestState>(...)` for managing [[IngestJob]] instances.

## Internal Functions

### `loadJobs(): IngestJob[]`
- **Purpose**: Loads persisted jobs from [[LocalStorage]] key `wiki-ingest-jobs`
- **Crash recovery**: Any job with `status === 'running'` is mapped to `failed` with log entry `'Connection lost due to page navigation'`
- **Error handling**: Returns `[]` silently if [[LocalStorage]] is unavailable or parse fails

### `persist(jobs: IngestJob[])`
- **Purpose**: Writes the full jobs array to [[LocalStorage]] key `wiki-ingest-jobs` via `JSON.stringify`
- **Error handling**: Silently catches [[LocalStorage]] errors

## Store Actions

- `startJob(path, name) → string`: Creates a new job with `running` status, filters duplicates by ID, persists immediately
- `updateJob(id, partial)`: Merges partial into existing job by ID, updates `updatedAt`, persists; schedules auto-dismiss via `setTimeout` after 5 seconds for `completed`/`failed` jobs
- `dismissJob(id)`: Filters out job by ID, persists
- `dismissAllCompleted()`: Filters out all jobs with `status === 'completed'`, persists

## Key Patterns
- Immutable updates via Zustand `set()`
- Synchronous state + persistence (no async race conditions)
- Auto-dismiss with state validation to prevent stale callbacks

## Connections
- [[useIngestStore|IngestJobStore]] — the entity page
- [[IngestJob]] — managed data type
- [[LocalStorage]] — persistence backend
- [[useIngestStream]] — related SSE consumer hook