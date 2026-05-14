---
title: "IngestionJobManager"
type: code_module
tags: [api, ingestion, job, progress]
sources: [api-server-fastapi-backend-for-llm-wiki-viewer]
last_updated: 2026-05-14
---

# IngestionJobManager

**File:** `tools/api_server.py` (in-memory job registry)

Manages in-memory ingestion job tracking for SSE progress streaming and WebSocket-based real-time progress updates.

## Key Functions

- `ingestion_jobs` — global dict `dict[str, dict]` tracking job state
- Jobs expire 1 hour after completion
- Used by `/api/upload` and WebSocket `/api/ws/ingest-progress`

## Integration

- [[LLMWiki API Server|api-server]] — hosts the job registry
- [[IngestWorkflow]] — the pipeline tracked by jobs
- [[WebSocket]] — protocol for real-time progress
