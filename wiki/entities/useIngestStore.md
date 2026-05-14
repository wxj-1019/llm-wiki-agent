---
title: "useIngestStore"
type: entity
tags: []
sources: [ingest-job-store-zustand-manager]
last_updated: 2026-05-14
---

# useIngestStore

**useIngestStore** is a [[Zustand]] store that manages the lifecycle of [[IngestJob]] instances in the LLM Wiki Viewer. It provides functions to start, update, and dismiss jobs, with [[LocalStorage]] persistence and crash recovery.

## API
- `jobs: IngestJob[]` — current list of jobs (loaded from localStorage on init)
- `startJob(path: string, name: string): string` — creates a new running job, returns its ID
- `updateJob(id: string, partial: Partial<IngestJob>): void` — applies partial updates, triggers auto-dismiss after 5s for completed/failed
- `dismissJob(id: string): void` — removes a job by ID
- `dismissAllCompleted(): void` — removes all completed jobs

## Connections
- [[IngestJob]] — the managed data type
- [[LocalStorage]] — persistence key `wiki-ingest-jobs`
- [[useIngestStream]] — related SSE consumer
- [[IngestWorkflow]] — the underlying workflow tracked