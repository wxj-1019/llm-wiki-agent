---
title: "HealthChecker — health.py module"
type: code_module
tags: [code, python, health, wiki]
sources: [health-tool-structural-health-checker]
---

# HealthChecker — `health.py` Module

## Overview
The `health.py` module provides structural health checks for the [[LLMWiki]]. It is purely deterministic with zero LLM calls. Contains 10 functions for checking empty files, index sync, broken links, and log coverage, plus auto-fix capabilities.

## Key Functions

### `check_empty_files(pages, threshold=100)`
Finds wiki pages with body content below the threshold (stub detection). Returns sorted list of dicts with `path`, `total_bytes`, `body_bytes`, `status` ('empty' or 'stub').

### `check_index_sync(pages)`
Compares `wiki/index.md` entries vs actual files on disk. Returns dict with `in_index_not_on_disk` (stale entries) and `on_disk_not_in_index` (orphaned files). Defensively skips paths outside repo root.

### `check_broken_links(pages)`
Parses all [[wikilinks]] across all wiki pages and reports those targeting non-existent pages. Handles `[[PageName]]` and `[[PageName|alias]]` formats.

### `check_log_coverage(pages)`
For each source page, checks `wiki/log.md` for a corresponding `ingest` entry. Matching is date-based: extracts dates from log entries and source page filenames/paths.

### `fix_index_sync(pages)`
Auto-repairs index: adds missing pages under the correct section and removes stale entries. Returns list of action descriptions.

### `fix_log_coverage(pages)`
Auto-repairs log coverage: appends missing `ingest` log entries for source pages. Returns list of action descriptions.

### `run_health()`
Orchestrates all checks. Returns dict with keys: `empty_files`, `index_sync`, `broken_links`, `log_coverage`.

### `format_report(results)`
Formats the health results dict as markdown, with separate sections for each check type and an [OK] indicator when no issues found.

## Related Code
- [[LLM]] (concept) — not used here; this module is deliberately API-free
- [[Lint]] (concept) — the semantic counterpart that does use [[LLM]] calls
- [[WikiIndex]], [[WikiLog]] (concepts) — the structures being validated