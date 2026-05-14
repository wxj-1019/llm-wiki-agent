---
title: "Ingest Tool (ingest.py) — Source Document Processing Engine"
type: source
tags: [ingest, python, wiki, tool]
date: 2026-05-14
source_file: tools/ingest.py
---

## Summary

The **Ingest Tool (`ingest.py`)** is the core script for absorbing external documents, code, and reports into the LLM Wiki. It automatically converts 20+ non-Markdown formats (PDF, DOCX, PPTX, HTML, JSON, etc.) via `markitdown[all]`, processes code files with AST extraction, and performs the full wiki update pipeline: creating source pages, updating index and overview, generating entity/concept pages, and logging changes. Supports batch, resume, incremental, and validate-only modes.

## Key Claims

- Supports auto-conversion of `.pdf`, `.docx`, `.pptx`, `.xlsx`, `.html`, `.htm`, `.txt`, `.csv`, `.json`, `.xml`, `.rst`, `.rtf`, `.epub`, `.ipynb`, `.yaml`, `.yml`, `.tsv`, `.wav`, `.mp3` via `markitdown[all]`.
- Code files (`.py`, `.js`, `.ts`, `.tsx`, `.jsx`) are ingested as plain text with automatic AST extraction (requires `tree-sitter`).
- Batch processing with sequential execution and checkpoint-driven resume/incremental logic.
- Post-ingest validation: checks for broken `[[wikilinks]]`, verifies all new pages appear in `wiki/index.md`, prints a change summary.
- Uses atomic file writes via `tempfile.mkstemp` + `os.replace` to prevent data corruption.
- Integrates with the LLM (via `tools/shared/llm.py` or inline fallback) for entity extraction and content generation.

## Key Quotes

> "Ingest a source document into the LLM Wiki."

> "Supported formats (auto-converted via markitdown): .pdf .docx .pptx .xlsx .html .htm .txt .csv .json .xml .rst .rtf .epub .ipynb .yaml .yml .tsv .wav .mp3"

## Connections

- [[Markitdown]] (concept) — auto-conversion library
- [[TreeSitter]] (entity) — AST extraction for code files
- [[IngestWorkflow]] (concept) — the full ingest workflow described in CLAUDE.md
- [[WikiIndex]] (concept) — index updated on every ingest
- [[WikiLog]] (concept) — append-only chronological record
- [[WikiOverview]] (concept) — living synthesis updated when warranted
- [[IngestCheckpoint]] (concept) — checkpoint mechanism for batch resume
- [[IngestError]] (concept) — custom exception for unrecoverable errors

## Contradictions

None.