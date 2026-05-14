---
title: "Code Graph Builder (builder.py) — High-Level Code Graph Construction"
type: source
tags: [code, graph, python, builder]
date: 2026-05-14
source_file: builder.py
---

## Summary

The `builder.py` module provides the high-level orchestration layer for building a unified code-level knowledge graph from source code repositories. It scans directories, identifies parsable files via the [[CodeParser]] [[code-graph-base-protocol|registry]], and returns deduplicated nodes and edges as plain dicts. Supports both full builds and incremental builds with hash-based change detection.

## Key Claims

- **Directory scanning**: Recursively scans configurable directories (`tools`, `wiki-viewer/src`, `src` by default) and excludes common non-source dirs (`__pycache__`, `node_modules`, `.venv`, etc.).
- **Parser integration**: Uses `registry.get_parser()` to select the correct [[CodeParser]] for each file based on extension.
- **Full build** (`build_code_graph`): Parses all files, deduplicates nodes by ID and edges by `(source, target, type)`.
- **Incremental build** (`build_code_graph_incremental`): Compares SHA256 hashes of files against a previous snapshot, only re-parses changed files, and merges unchanged nodes/edges.
- **File size cap**: Skips files larger than 5 MB (`MAX_FILE_SIZE`).
- **Hash utility** (`_file_hash`): Returns first 16 hex characters of SHA256 for change detection.
- **Save function** (`save_code_graph`): Writes a `graph.json`-compatible payload with node count, edge count, and builder metadata.
- **Deleted file handling**: Incremental build detects deleted files by comparing hash keys and removes associated nodes/edges from the graph.

## Connections
- [[CodeParser]] (concept) — the protocol for language-specific parsers, resolved via `registry.get_parser()`
- [[CodeNode]] (concept) — dataclass representing code elements
- [[CodeEdge]] (concept) — dataclass representing code relationships
- [[CodeGraphRegistry]] (concept) — the registry module that maps extensions to parsers
- [[IncrementalGraphBuild]] (concept) — incremental build strategy
- [[SHA256GraphCache]] (concept) — hash-based change detection
- [[build_graph.py|BuildGraphMain]] (code) — downstream consumer of this builder's output

## Contradictions
None.