---
title: "Wiki Watcher — File System Watcher with Auto-Ingest and Graph Rebuild"
type: source
tags: [automation, watcher, ingest, graph-rebuild, debounce]
date: 2026-05-14
source_file: tools/watcher.py
---

## Summary

The `watcher.py` script is a file system watcher for the `raw/` directory that auto-ingests files on change. It supports foreground, background (daemon), and one-shot modes. It uses polling or [[watchdog]] (if available) for file monitoring, debounces rapid events into batches, and can optionally watch code directories and automatically rebuild the knowledge graph when source files change.

## Key Claims

- **Three operation modes**: `--once` processes existing files then exits; `--daemon` detaches from terminal (Unix); foreground polling/watchdog mode for interactive use.
- **Debounced ingestion**: File change events are debounced by `g_DEBOUNCE_SEC` (default 5s) to batch rapid events. Only files with changed SHA256 hash are actually ingested.
- **Graph rebuild on change** (optional `--graph` flag): Watches `tools/` and `wiki-viewer/src/` for Python/TypeScript/JSX/CSS changes; debounces separately with 10s interval; runs `build_graph.py --incremental --code --no-infer`.
- **Hash-based dedup**: Maintains `g_file_hashes` and `g_graph_hashes` dicts to avoid re-processing unchanged files.
- **File filters**: Filters out `.gitkeep`, dotfiles, and non-files from ingest; filters out `__pycache__`, `node_modules`, `.venv`, `dist`, `build`, `graph` from graph rebuild.
- **Graceful fallback**: If [[watchdog]] is not installed, falls back to polling mode with an info log message.

## Key Quotes

> "File system watcher for raw/ directory — auto-ingest on change."

> "SHA256 of file content" — `_file_hash()` returns `sha256.hexdigest()[:16]` for quick comparison.

## Connections

- [[IngestTool]] — `ingest.py` is called by the watcher for each changed file
- [[BuildGraphTool]] — `build_graph.py` is called when graph rebuild is triggered
- [[DebouncePattern]] — debounce logic for batching rapid file events
- [[CodeGraphBuilder]] — invoked via `build_graph.py` for code changes
- [[FileWatcher]] — watchdog library for efficient file system monitoring

## Contradictions

None.