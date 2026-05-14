---
title: "Query Tool (query.py) — LLM Wiki Query Engine"
type: source
tags: [query, python, wiki, tool]
date: 2026-05-14
source_file: tools/query.py
---

## Summary

The **Query Tool** (`query.py`) is the natural language interface for the LLM Wiki. It accepts a free-form question, identifies relevant pages via the wiki index and graph-based neighbor expansion, reads their content, and synthesizes an answer using the configured [[LLM]]. Answers can be optionally saved as synthesis pages with automatic index and log updates. Supports CJK-aware matching for Chinese-language indexes.

## Key Claims

- **Relevance matching**: Uses character-level sliding window for CJK compatibility (`\u3400-\u9fff`) and word-level matching for Latin scripts.
- **Graph-based expansion**: When `graph/graph.json` exists, loads high-confidence edges (≥0.7) to find neighboring pages of initially matched results, dynamically expanding context.
- **Context cap**: Limits relevant pages to 15 to prevent LLM context overflow.
- **Inline fallbacks**: Full inline implementations of `read_file`, `write_file`, `sanitize_wiki_path`, `call_llm`, `append_log`, and `_load_llm_config` for when shared utilities are not importable.
- **Save workflow**: `--save` flag triggers prompt or direct path for saving the synthesis; auto-updates `wiki/index.md` and `wiki/log.md`.
- **Agent memory injection**: Loads `wiki/.agent/MEMORY.md` and `wiki/.agent/USER.md` as system context to personalize LLM responses (~2200+1375 char limits).
- **Atomic file writes**: Uses `tempfile.mkstemp` + `os.replace` to prevent data corruption.
- **Path traversal protection**: All file writes go through `sanitize_wiki_path` which enforces subdirectory confinement to `WIKI_DIR`.

## Key Quotes

> "Query the LLM Wiki."

> "Synthesized answer from {len(relevant_pages)} pages."

## Connections
- [[LLM]] (concept) — used via `call_llm()` with `litellm` for answer synthesis
- [[WikiIndex]] (concept) — parsed for page relevance matching, updated on save
- [[WikiLog]] (concept) — appended with `## [YYYY-MM-DD] query | ...` logging
- [[GraphJSON]] (entity) — loaded for graph-based context expansion
- [[IngestTool]] (concept) — companion tool for absorbing new content into the wiki
- [[syntheses]] (wiki layer) — saved answers are stored here

## Contradictions
None.