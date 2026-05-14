---
title: sanitize_wiki_path()
type: code_func
tags: [security, path, utility]
sources: [query-tool-llm-wiki-query-engine]
last_updated: 2026-05-14
---

# `sanitize_wiki_path(path_str, base_dir) -> Path`

**Defined in:** `tools/query.py` (inline fallback)

## Purpose
Sanitizes a file path string to prevent path traversal attacks. Resolves the target path and ensures it is contained within `base_dir`. Rejects `.`, `..`, and empty strings.

## Parameters
- `path_str` (str) — User-supplied path (e.g. `"syntheses/my-analysis.md"`).
- `base_dir` (Path) — Allowed base directory (e.g. `WIKI_DIR`).

## Returns
- `Path` — The resolved, validated absolute path.

## Raises
- `ValueError` — If path is invalid or escapes `base_dir`.

## Connections
- [[Security]] (concept) — path traversal prevention