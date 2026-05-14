---
title: "BatchIngest"
type: entity
tags: [pipeline, legacy, architecture]
sources: [overview.md, AutoIngestModule.md, auto-ingest-pipeline-auto-ingest-py.md]
---

# BatchIngest

In the context of this wiki's automation infrastructure, **BatchIngest** refers to the legacy processing pipeline for ingesting source documents into the wiki, distinguished from the newer, LLM-free "fast path" provided by `auto_ingest.py`. Historically, BatchIngest was the primary method for converting raw documents into structured wiki source pages, but it required LLM calls—making it slower and more resource-intensive. The system has since evolved: `auto_ingest.py` now bypasses BatchIngest entirely for most routine fetches, handling quality scoring, entity detection, near-duplicate filtering, wikilink generation, and graph rebuild triggering with zero LLM involvement. As a result, BatchIngest remains as an architectural reference point—the older, heavier process that the current fast-path automation supersedes. Its primary significance is as a contrast: it represents the system's prior reliance on language model calls for ingestion, a dependency that has been eliminated in the optimized pipeline.