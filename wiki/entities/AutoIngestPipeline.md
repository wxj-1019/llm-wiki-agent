---
title: "AutoIngestPipeline"
type: entity
tags: [automation, pipeline, ingest]
sources: [auto-ingest-pipeline-auto-ingest-py]
last_updated: 2026-05-14
---

# AutoIngestPipeline

The `auto_ingest.py` script — a zero-LLM fast path for the [[AutomationPipeline]] that directly converts fetched `.md` files from `raw-inbox/fetched/` into structured `wiki/sources/` pages. It includes [[QualityScoring]] (heuristic 0-100), [[EntityDetection]] (fuzzy matching + keywords), [[NearDuplicateDetection]] (MD5 content fingerprinting), and automatic [[wikilink]] generation.

## Key Features
- No LLM calls — fully deterministic processing
- Configurable quality threshold (`--min-quality`, default 30)
- Near-duplicate filtering using content hashes
- Entity/concept auto-detection with stub page creation
- Post-ingest graph rebuild trigger (`build_graph.py rebuild-hot`)

## Related
- [[BatchIngest]] — the legacy LLM-powered path that `AutoIngestPipeline` bypasses
- [[QualityScoring]] — the quality assessment algorithm it uses
- [[ContentFingerprinting]] — the dedup mechanism it employs
- [[StateManagement]] — state.json persistence
