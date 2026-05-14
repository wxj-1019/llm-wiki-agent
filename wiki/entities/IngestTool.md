---
title: "IngestTool"
type: entity
tags: [ingest, pipeline, automation, wiki-maintenance]
sources: [overview.md, AutoIngestModule.md, RefreshToolRefreshPy.md, WikiWatcher.md, auto-ingest-pipeline-auto-ingest-py.md, query-tool-llm-wiki-query-engine.md, refresh-tool-stale-source-page-refresher.md, wiki-watcher-file-system-watcher.md]
---

# IngestTool

The **IngestTool** is a conceptual entity encompassing the set of automation mechanisms and scripts within the Personal LLM Wiki responsible for the acquisition, validation, transformation, and integration of raw source documents into structured, wiki-accessible knowledge. It is not a single program but rather a functional abstraction that includes the `auto_ingest.py` fast-path pipeline (which performs quality scoring, entity detection, near-duplicate filtering, and direct `.md` conversion from fetched raw-inbox files), the `refresh.py` stale-source-page refresher (which detects content changes via SHA256 hash comparison and triggers re-ingestion), and the `watcher.py` file-system monitor (which provides automated, debounced ingestion and optional graph rebuilds upon file changes in the `raw/` directory). The IngestTool's primary significance lies in maintaining the wiki's integrity and freshness without reliance on LLM calls during the ingestion phase, thereby enabling a zero-LLM fast path for routine updates. It associates closely with the knowledge graph builder (triggering graph rebuilds post-ingest), the query tool (which relies on the updated index and source pages for relevance matching), and the overall wiki state synthesis page, which is regenerated on every ingest to reflect the current corpus.