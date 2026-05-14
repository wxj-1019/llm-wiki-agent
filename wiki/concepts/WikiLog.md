---
title: "WikiLog"
type: concept
tags: [wiki, log]
sources: [ingest-tool-source-document-processing-engine]
last_updated: 2026-05-14
---

# WikiLog

The **Wiki Log** (`wiki/log.md`) is an append-only chronological record of all wiki operations. Each entry starts with `## [YYYY-MM-DD] <operation> | <title>`, making it grep-parseable. Operations include `ingest`, `query`, `health`, `lint`, `graph`. The [[IngestTool|ingest tool]] appends a new entry after each successful document ingestion.