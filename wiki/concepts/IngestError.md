---
title: "IngestError"
type: concept
tags: [ingest, error]
sources: [ingest-tool-source-document-processing-engine]
last_updated: 2026-05-14
---

# IngestError

`IngestError` is a custom exception raised by the [[IngestTool|ingest tool]] when it encounters an unrecoverable error during document processing (e.g., unreadable file, path traversal, critical validation failure). It is distinct from unexpected exceptions.