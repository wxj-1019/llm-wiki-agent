---
title: "ContentFingerprinting"
type: entity
tags: [automation, dedup, fingerprinting]
sources: [auto-ingest-pipeline-auto-ingest-py]
last_updated: 2026-05-14
---

# ContentFingerprinting

A near-duplicate detection mechanism used by [[AutoIngestPipeline]] to avoid re-ingesting the same content. It generates an MD5 hash of the body text after whitespace normalization, and compares it against previously seen hashes stored in `state.json`.

## Related
- [[AutoIngestPipeline]] — primary consumer
- [[QualityScoring]] — complementary quality assessment
- [[StateManagement]] — hash persistence in state.json
