---
title: "Ingest Job Store — Zustand Manager for Ingest Job State"
type: source
tags: [frontend, typescript, zustand, ingest, job, state-management]
date: 2026-05-14
source_file: ingestStore.ts
---

## Summary
The `useIngestStore` is a Zustand-based state management store for tracking ingest job lifecycle in the LLM Wiki Viewer frontend. It manages [[IngestJob]] objects through running/completed/failed states, persists job history to [[LocalStorage]] with recovery from page navigation interruptions, and auto-dismisses completed/failed jobs after 5 seconds.

## Key Claims
- **Full job lifecycle**: `startJob` creates a new `IngestJob` with `running` status and `logs: ['Starting ingest...']`. `updateJob` applies partial updates (`status`, `progress`, `logs`, `returncode`) with automatic `updatedAt` timestamp. `dismissJob` removes a job by ID. `dismissAllCompleted` removes all completed jobs, keeping running/failed ones visible.
- **LocalStorage persistence with crash recovery**: On store initialization, `loadJobs` reads from `localStorage` key `wiki-ingest-jobs`. Any job with `status: 'running'` is automatically marked `failed` with the log entry `'Connection lost due to page navigation'` — this prevents stuck "running" phantom jobs when the user navigates away during an SSE stream.
- **Auto-dismiss after 5 seconds**: When `updateJob` transitions a job to `completed` or `failed`, a `setTimeout` schedules automatic dismissal after 5 seconds, giving the user time to see the result. The auto-dismiss checks that the job hasn't been manually updated to a different state in the meantime.
- **Immutable updates via Zustand**: All mutations use `set()` with new array creation and immediate `persist()` call to localStorage — state and persistence are always in sync.
- **Error-resilient persistence**: Both `loadJobs` and `persist` wrap localStorage operations in try/catch blocks, gracefully degrading when localStorage is unavailable (private browsing, storage quota exceeded).
- **Deduplicated start**: `startJob` filters out any existing job with the same ID before adding the new one, preventing duplicate entries on re-renders.

## Key Quotes
> "`const id = \`job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}\`;`" — job ID generation pattern
> "`if (raw) { const parsed: IngestJob[] = JSON.parse(raw); return parsed.map((j) => j.status === 'running' ? { ...j, status: 'failed', logs: [...j.logs, 'Connection lost due to page navigation'] } : j); }`" — crash recovery on initialization
> "`if (partial.status === 'completed' || partial.status === 'failed') { setTimeout(() => { ... get().dismissJob(id); }, 5000); }`" — auto-dismiss pattern

## Connections
- [[IngestJob]] — the data type managed by this store
- [[LocalStorage]] — persistence backend
- [[useIngestStream]] — related SSE consumer hook that drives job state updates
- [[RootLayout]] — parent consuming this hook for job notifications
- [[IngestWorkflow]] — the ingestion workflow this store tracks

## Contradictions
- None identified.