---
title: "IngestJob"
type: entity
tags: []
sources: [ingest-job-store-zustand-manager]
last_updated: 2026-05-14
---

# IngestJob

**IngestJob** is the data type representing a single file ingestion process in the LLM Wiki Viewer frontend. It is managed by [[useIngestStore]].

## Fields
- `id: string` — unique job identifier in format `job-{timestamp}-{random}`
- `path: string` — file path being ingested
- `name: string` — display name of the file
- `status: 'running' | 'completed' | 'failed'` — current lifecycle state
- `logs: string[]` — chronological log entries
- `progress: number` — progress indicator (0-100)
- `returncode?: number` — process exit code (only on completion)
- `createdAt: number` — timestamp when job was started
- `updatedAt: number` — timestamp of last state change

## Connections
- [[useIngestStore]] — Zustand store managing [[IngestJob]] instances
- [[useIngestStream]] — SSE consumer that updates [[IngestJob]] state
- [[LocalStorage]] — persistence backend for job history