---
title: "IngestCheckpoint"
type: concept
tags: [ingest, checkpoint, resume]
sources: [ingest-tool-source-document-processing-engine]
last_updated: 2026-05-14
---

# IngestCheckpoint

The **Ingest Checkpoint** mechanism persists per-file processing status (hash, success/failure, timestamp) to `.cache/ingest-checkpoint.json`. This enables `--resume` (retry only failed files) and `--incremental` (skip unchanged files) modes in the [[IngestTool|ingest tool]], improving efficiency in batch operations.