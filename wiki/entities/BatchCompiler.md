---
title: "BatchCompiler"
type: entity
tags: [pipeline, automation, batch-processing]
sources: [overview.md, AutoIngestModule.md, auto-ingest-pipeline-auto-ingest-py.md]
---

# BatchCompiler

The BatchCompiler is the legacy batch processing pipeline in the Personal LLM Wiki system, responsible for ingesting and structuring documents before the introduction of the faster, zero-LLM auto-ingest path. It stands in contrast to the `auto_ingest.py` module—where the BatchCompiler requires LLM calls for processing and consequently operates as a heavier, more resource-intensive pipeline, the auto-ingest path bypasses it entirely for direct conversion of fetched Markdown files. The BatchCompiler is primarily associated with the older, slower ingestion workflow; the wiki's automation architecture has since shifted toward the auto-ingest pipeline for routine processing, relegating the BatchCompiler to a supporting or fallback role. Its significance lies in representing the previous generation of the ingest infrastructure, which the current system has optimized away for efficiency and speed.