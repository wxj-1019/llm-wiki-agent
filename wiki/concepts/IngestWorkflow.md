---
title: "IngestWorkflow"
type: concept
tags: [ingest, wiki, workflow]
sources: [ingest-tool-source-document-processing-engine]
last_updated: 2026-05-14
---

# IngestWorkflow

The **Ingest Workflow** is the standard procedure for absorbing new source documents into the LLM Wiki. Steps: read source → read wiki context → write source page → update index → update overview → create/update entity pages → create/update concept pages → log → validate. Triggered via `/wiki-ingest` or by saying "ingest <file>". Supports batch, resume, incremental, and validate-only modes. Detailed in the CLAUDE.md schema.