---
title: "Health Tool (health.py) — Structural Health Checker for LLM Wiki"
type: source
tags: [health, python, wiki, tool, maintenance]
date: 2026-05-14
source_file: tools/health.py
---

## Summary
The **Health Tool** (`health.py`) is a purely deterministic, zero-LLM-call structural integrity checker for the LLM Wiki. It performs three categories of checks — empty/stub files, index synchronization, and log coverage — and outputs a report in markdown or JSON. Designed to be fast enough to run every session, it operates as the pre-flight complement to the more expensive semantic [[Lint]] tool.

## Key Claims
- **Zero LLM calls**: All checks are deterministic — no API calls, no token consumption.
- **Three check categories**:
  - **Empty / Stub files**: Pages whose body content (after removing frontmatter) is below `STUB_THRESHOLD_CHARS` (100 bytes).
  - **Index sync**: Compares `wiki/index.md` entries against actual `.md` files on disk; reports stale index entries and orphaned files.
  - **Log coverage**: For each source page, checks if `wiki/log.md` contains a corresponding `ingest` entry (via date-based matching).
- **Auto-fix mode** (`--fix`): Can automatically repair index sync issues (add missing entries, remove stale ones) and log coverage gaps (append missing log entries).
- **Output formats**: Markdown (default), JSON (`--json`), optional save to `wiki/health-report.md` (`--save`).
- **Inline fallbacks**: Has fully self-contained inline implementations of `read_file()`, `all_wiki_pages()`, `strip_frontmatter()`, `extract_frontmatter_title()`, `extract_wikilinks()`, and `append_log()` in case shared utilities are not importable.
- **Defensive guards**: Skips meta-pages (`overview.md`, `index.md`, `log.md`), reports only. Skips paths that resolve outside `REPO_ROOT`.
- **Broken link check** (`check_broken_links`): Parses all wikilinks across all wiki pages and reports those targeting non-existent pages, including detection of [[PageName|alias]] patterns.

## Key Quotes
> "Unlike lint.py (which includes expensive LLM-powered semantic analysis), health.py is purely deterministic — zero API calls, fast enough to run every session."

## Connections
- [[Lint]] (concept) — semantic counterpart; runs LLM-based checks every 10-15 ingests
- [[WikiIndex]] (concept) — parsed and validated for sync with actual filesystem
- [[WikiLog]] (concept) — checked for coverage against existing source pages
- [[IngestWorkflow]] (concept) — health check is recommended pre-flight before every ingest session

## Contradictions
- None identified.