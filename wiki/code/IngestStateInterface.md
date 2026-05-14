---
title: "IngestState"
type: code_class
tags: [typescript, frontend]
sources: [ingest-job-store-zustand-manager]
last_updated: 2026-05-14
---

# IngestState

```typescript
interface IngestState {
  jobs: IngestJob[];
  startJob: (path: string, name: string) => string;
  updateJob: (id: string, partial: Partial<IngestJob>) => void;
  dismissJob: (id: string) => void;
  dismissAllCompleted: () => void;
}
```

## Description
`IngestState` defines the shape of the [[useIngestStore]] Zustand store, including the current job list and all mutation actions.

## Connections
- [[useIngestStore]] — the store implementing this interface
- [[IngestJob]] — the type of items in `jobs` array