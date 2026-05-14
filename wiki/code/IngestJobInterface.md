---
title: "IngestJob"
type: code_class
tags: [typescript, frontend]
sources: [ingest-job-store-zustand-manager]
last_updated: 2026-05-14
---

# IngestJob

```typescript
interface IngestJob {
  id: string;
  path: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  logs: string[];
  progress: number;
  returncode?: number;
  createdAt: number;
  updatedAt: number;
}
```

## Fields
- `id`: unique identifier in format `job-{timestamp}-{random}`
- `path`: file path being ingested
- `name`: user-friendly display name
- `status`: lifecycle state (`running` → `completed`/`failed`)
- `logs`: array of log messages
- `progress`: 0-100 progress indicator
- `returncode`: optional process exit code on completion
- `createdAt`: Unix timestamp of creation
- `updatedAt`: Unix timestamp of last mutation

## Connections
- [[useIngestStore]] — store managing [[IngestJob]] instances
- [[IngestWorkflow]] — the workflow this type represents