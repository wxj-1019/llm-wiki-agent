---
title: "auto_ingest"
type: code_module
tags: [automation, pipeline]
sources: [auto-ingest-pipeline-auto-ingest-py]
last_updated: 2026-05-14
---

# auto_ingest

**File:** `tools/auto_ingest.py`

A zero-LLM fast-path automation pipeline that directly converts fetched `.md` files from `raw-inbox/fetched/` into structured `wiki/sources/` pages. It performs quality scoring, entity/concept detection, near-duplicate filtering, and post-ingest graph rebuild triggering.

## Public API

### `run(source_filter=None, single_file=None, dry_run=False, min_quality=30, verbose=False) -> int`
Main entry point. Scans fetched files, scores quality, detects entities, builds source pages, updates index/log, and optionally triggers graph rebuild.

### `_score_quality(title, body) -> tuple[float, str, list[str]]`
Heuristic quality assessment (0-100). Returns score, grade (excellent/good/fair/poor/noise), and list of scoring reasons.

### `_detect_entities(body, index) -> dict[str, list[str]]`
Detects entities and concepts mentioned in body text using fuzzy matching against the wiki page index.

### `_content_fingerprint(text, threshold=0.95) -> str`
Generates a normalized MD5 hash for near-duplicate detection.

### `_build_source_page(title, body, meta, index, source_type, source_file, quality_info) -> tuple[str, list[str], list[str]]`
Constructs the full markdown source page with wikilinks and structured frontmatter.

### `_update_index(title, slug)`
Updates `wiki/index.md` with a new source entry.

### `_update_log(title)`
Appends an ingest entry to `wiki/log.md`.

## Related
- [[IngestTool]] — the LLM-powered alternative for complex content
- [[BatchCompiler]] + [[BatchIngest]] — legacy pipeline bypassed by this module
- [[BuildGraphTool]] — triggered post-ingest by this module
- [[StateManagement]] — state.json persistence used here
