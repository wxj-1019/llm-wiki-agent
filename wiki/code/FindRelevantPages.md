---
title: find_relevant_pages()
type: code_func
tags: [query, relevance]
sources: [query-tool-llm-wiki-query-engine]
last_updated: 2026-05-14
---

# `find_relevant_pages(question, index_content) -> list[Path]`

**Defined in:** `tools/query.py`

## Purpose
Extracts wiki pages linked from `wiki/index.md` that are likely relevant to a natural language question. Supports CJK text via 2-character sliding window bigram matching, and Latin text via word-level overlap. Also performs graph-based context expansion using `graph/graph.json` for high-confidence (≥0.7) edges.

## Parameters
- `question` (str) — User's natural language query.
- `index_content` (str) — The text of `wiki/index.md`.

## Returns
- `list[Path]` — Up to 15 resolved wiki file paths, always including `wiki/overview.md` first.

## Key Logic
- Detects CJK ranges (`\u3400-\u9fff`, `\u4e00-\u9fff`).
- For CJK: checks if any 2-char bigram from the title appears in the question.
- For Latin: checks if any word (len>2) from the title appears in the question.
- Graph expansion: finds neighbors of matched pages via edges with confidence ≥ 0.7.

## Connections
- [[WikiIndex]] (concept) — parsed for page list
- [[GraphJSON]] (entity) — loaded for neighbor expansion