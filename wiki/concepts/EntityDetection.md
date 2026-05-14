---
title: "EntityDetection"
type: concept
tags: [automation, entity, detection]
sources: [auto-ingest-pipeline-auto-ingest-py]
last_updated: 2026-05-14
---

# EntityDetection

The process of automatically identifying named entities (people, companies, products, technologies) in ingested content and either linking them to existing wiki pages or creating new stub pages. Heuristic approaches (substring matching + fuzzy matching against existing wiki indexes) can perform this without LLM calls.

## Related
- [[AutoIngestPipeline]] — implementation in `_detect_entities()`
- [[WikiPageIndex]] — the index structure used for lookup
