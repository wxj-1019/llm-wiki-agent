---
title: "refresh.py"
type: code_module
tags: [refresh, maintenance, tool]
sources: [refresh-tool-stale-source-page-refresher]
last_updated: 2026-05-14
---

# refresh.py

## Module: `tools/refresh.py`

Detects and re-ingests stale wiki source pages by comparing SHA256 hashes of raw documents against a persistent cache.

### Functions

#### `sha256(text: str) -> str`
Computes the first 16 hex characters of the SHA256 hash of the input text.

#### `read_file(path: Path) -> str`
Reads a file's content as UTF-8 text. Returns empty string on missing file or UnicodeDecodeError.

#### `load_refresh_cache() -> dict`
Loads the refresh cache from `graph/.refresh_cache.json`. Returns empty dict on corruption.

#### `save_refresh_cache(cache: dict)`
Saves the refresh cache to `graph/.refresh_cache.json`.

#### `extract_source_file(content: str) -> Optional[str]`
Extracts the `source_file:` field from YAML frontmatter using regex.

#### `find_stale_sources(force: bool = False) -> list[tuple[Path, Path]]`
Iterates `wiki/sources/*.md`, extracts `source_file:` frontmatter, resolves to a raw path, computes hash, and returns `(wiki_page, raw_path)` pairs that need refresh (hash mismatch or `force=True`). Rejects out-of-bounds paths.

#### `refresh_page(wiki_page: Path, raw_path: Path) -> bool`
Calls `python tools/ingest.py <raw_path>` as subprocess with 300s timeout. Returns True on success.

#### `main()`
Entry point with `--force`, `--page`, `--dry-run` arguments.

### Connections

- [[IngestTool]] — called via subprocess for re-ingestion
- [[BuildGraphTool]] — shares cache directory convention
- [[RefreshTool]] — entity representing this module