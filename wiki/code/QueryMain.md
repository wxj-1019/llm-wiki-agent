---
title: query()
type: code_func
tags: [query, entrypoint]
sources: [query-tool-llm-wiki-query-engine]
last_updated: 2026-05-14
---

# `query(question, save_path=None)`

**Defined in:** `tools/query.py`

## Purpose
Main entry point for querying the LLM Wiki. Orchestrates the full pipeline: load agent context, read index, find relevant pages, read page content, synthesize answer via [[LLM]], optionally save synthesis as `wiki/syntheses/` with index and log updates.

## Parameters
- `question` (str) — Natural language question.
- `save_path` (str|None) — If `""` (empty string), prompts interactively. If a path string (e.g. `"syntheses/foo.md"`), saves directly. If `None`, no save.

## Key Steps
1. Load agent memory (`MEMORY.md` + `USER.md`) as system context.
2. Read `wiki/index.md` and extract page links.
3. Call `find_relevant_pages()` with CJK/graph expansion.
4. Read content of up to 15 pages + the question.
5. Call `call_llm()` with detailed prompt.
6. Optionally save synthesis with YAML frontmatter, atomically write to `wiki/syntheses/<slug>.md`, update `wiki/index.md` and `wiki/log.md`.

## Connections
- [[AgentMemory]] (entity) — injected as system context
- [[WikiOverview]] (concept) — always included in context
- [[CallLLM]] (code) — used for synthesis generation