---
title: WikiWatcher
type: code_module
tags: [watcher, automation, ingest, graph-rebuild]
date: 2026-05-14
source_file: tools/watcher.py
---

# WikiWatcher — `tools/watcher.py`

File system watcher for [[RawDirectory|`raw/`]] directory with auto-ingest and optional graph rebuild.

## Module-Level Functions

### `_file_hash(path: Path) -> str`
Returns SHA256 hex digest (first 16 chars) of file content.

### `_is_ingestable(path: Path) -> bool`
Checks if file should be ingested: not `.gitkeep`, not dotfile, is file.

### `_is_graphable(path: Path) -> bool`
Checks if file change should trigger graph rebuild: valid extension (`.py`, `.ts`, `.tsx`, `.js`, `.jsx`, `.md`), not in excluded dirs (`__pycache__`, `node_modules`, `.venv`, `dist`, `build`, `graph`).

### `_run_ingest(paths: list[Path]) -> None`
Runs `ingest.py` on each file with 5-minute timeout.

### `_run_graph_build(paths: list[Path]) -> None`
Runs `build_graph.py --incremental --code --no-infer` with 2-minute timeout.

### `_flush_pending()`
Debounce flush: filters out unchanged files via hash, calls `_run_ingest` for changed ones.

### `_flush_graph_pending()`
Debounce flush for graph rebuild: filters unchanged files, calls `_run_graph_build`.

### `_schedule(rel_path: str)`
Adds file to pending set and resets debounce timer.

### `_schedule_graph(rel_path: str)`
Adds file to graph pending set and resets graph debounce timer.

### `_scan_existing(graph_mode: bool)`
Processes all existing files in `raw/` (and optionally graph dirs).

### `_watch_with_watchdog(graph_mode: bool)`
Uses [[Watchdog]] observer to monitor `raw/` and graph dirs; debounces events via `_schedule`/`_schedule_graph`.

### `_watch_with_polling(graph_mode: bool)`
Polls directories every 2s, scans for new/changed files.

### `main()`
CLI entry point: parses args (`--once`, `--daemon`, `--poll`, `--debounce`, `--graph`), starts appropriate watcher.

## Configuration

- `g_DEBOUNCE_SEC` = 5.0s (ingest debounce)
- `g_GRAPH_DEBOUNCE_SEC` = 10.0s (graph rebuild debounce)
- `RAW` = `REPO / "raw"`
- `INGEST_SCRIPT` = `REPO / "tools" / "ingest.py"`
- `GRAPH_BUILD_SCRIPT` = `REPO / "tools" / "build_graph.py"`
- `GRAPH_DIRS` = `[REPO / "tools", REPO / "wiki-viewer" / "src"]`
- `GRAPH_EXTS` = `{".py", ".ts", ".tsx", ".js", ".jsx", ".md"}`

## Related

- [[IngestTool]] — called by `_run_ingest`
- [[BuildGraphTool]] — called by `_run_graph_build`
- [[CodeGraphBuilder]] — invoked via `build_graph.py`
- [[DebouncePattern]] — debounce logic
- [[FileWatcher]] — watchdog library
- [[EventDrivenArchitecture]] — event-driven file processing