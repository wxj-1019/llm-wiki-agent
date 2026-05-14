---
title: "CodeGraphBuilder — High-Level Code Graph Construction"
type: code_module
tags: [code, graph, builder]
sources: [code-graph-builder-builder-py]
last_updated: 2026-05-14
---

# CodeGraphBuilder

**Source file:** `builder.py`

High-level orchestration module for building unified code-level knowledge graphs from source code repositories. Provides functions for scanning directories, parsing files via the [[CodeParser]] registry, and producing deduplicated node/edge lists.

## Functions

### `scan_files(repo_root, dirs, exclude, max_size) -> list[Path]`
Scans specified directories recursively, filtering by file extension (via registry), size cap (5 MB default), and exclusion set. Returns list of parsable [[Path]] objects.

### `build_code_graph(repo_root, dirs, exclude) -> (list[dict], list[dict])`
Full build: scans, parses all files, deduplicates by ID (nodes) and `(source, target, type)` (edges), returns plain dicts.

### `build_code_graph_incremental(repo_root, existing_nodes, existing_edges, code_hashes, dirs, exclude) -> (list[dict], list[dict], dict[str, str])`
Incremental build: compares SHA256 hashes against a previous snapshot, re-parses only changed files, merges unchanged nodes/edges. Detects deleted files and removes associated graph elements.

### `save_code_graph(repo_root, out_path, dirs, exclude) -> None`
Convenience function: builds full graph and writes a `graph.json`-compatible payload with metadata.

### `_file_hash(path) -> str`
Internal utility: returns first 16 hex characters of SHA256 digest of file contents.

## Related Pages
- [[CodeParser]] — protocol for language-specific parsers
- [[CodeNode]] and [[CodeEdge]] — data structures produced by parsers
- [[CodeGraphRegistry]] — the registry mapping extensions to parsers
- [[IncrementalGraphBuild]] and [[SHA256GraphCache]] — concepts underlying incremental builds