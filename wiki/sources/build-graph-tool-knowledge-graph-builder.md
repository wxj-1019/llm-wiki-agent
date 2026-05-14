---
title: "Build Graph Tool (build_graph.py) — Knowledge Graph Builder"
type: source
tags: [graph, python, wiki, tool, visualization]
date: 2026-05-14
source_file: tools/build_graph.py
---

## Summary

The **Build Graph Tool** (`build_graph.py`) is the knowledge graph generation engine for the LLM Wiki. It performs a two-pass build: first parsing all explicit `[[wikilinks]]` from wiki pages to produce `EXTRACTED` edges, then using LLM inference to detect implicit relationships (`INFERRED` edges) with confidence scores. It supports Louvain or Leiden community detection, produces an interactive vis.js HTML visualization, and can optionally include project source code files in the graph. Features incremental rebuild via SHA256 caching, checkpoint resume for inference, and a graph health report generator.

## Key Claims

- **Two-pass architecture**: Pass 1 extracts deterministic `[[wikilinks]]` edges; Pass 2 uses an [[LLM]] (via `litellm`) to infer implicit relationships and assigns confidence levels (`INFERRED` vs `AMBIGUOUS`).
- **Community detection**: Supports both [[Louvain]] (via `networkx`) and [[Leiden]] (via `python-igraph` + `leidenalg`) algorithms for clustering nodes into topic communities.
- **Interactive visualization**: Outputs `graph/graph.html` using vis.js with type-colored nodes and edge-type-colored connections, plus physics simulation for layout.
- **Incremental builds**: SHA256-based caching avoids re-parsing unchanged pages; `--incremental` mode for code file changes.
- **Code graph support**: `--code` flag includes Python and TypeScript source files as nodes with their `[[wikilinks]]` and code-level relationships.
- **Health report**: `--report` flag generates structured analysis including orphan nodes, god nodes, fragile bridges, and phantom hubs (missing pages referenced by 2+ existing pages).
- **Checkpoint resume**: Inferred edges are checkpointed to `.inferred_edges.jsonl` and `.cache.json` for crash recovery.
- Uses `networkx` for graph analysis and community detection; falls back gracefully if not installed.

## Key Quotes

> "Build the knowledge graph from the wiki."

> "Two-pass build with Louvain clustering."

> "Extracted edges from [[wikilinks]]; Inferred edges from semantic analysis."

## Connections

- [[Louvain]] (concept) — community detection algorithm used for grouping related wiki pages
- [[Leiden]] (concept) — higher-quality community detection algorithm (optional dependency)
- [[NetworkX]] (entity) — Python graph analysis library
- [[VisJS]] (entity) — JavaScript visualization library used for interactive graph rendering
- [[GraphHTML]] (concept) — the generated HTML visualization file
- [[GraphHealthReport]] (concept) — structured analysis of graph structure
- [[GraphJSON]] (concept) — node/edge data format stored in `graph/graph.json`
- [[CommunityDetection]] (concept) — the algorithm for identifying topic clusters
- [[LLM]] (entity) — used in Pass 2 for semantic inference of implicit relationships
- [[Litellm]] (entity) — universal LLM API gateway used for inference
- [[BuildGraphTool]] (entity) — the tool itself, referenced as a development tool

## Contradictions

None.