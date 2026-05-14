---
title: "build_graph() — Main Entry Point"
type: code_func
tags: [graph, build, main]
sources: [build-graph-tool-knowledge-graph-builder]
last_updated: 2026-05-14
---

## Signature

```python
def build_graph(
    infer: bool = True,
    open_browser: bool = False,
    clean: bool = False,
    report: bool = False,
    save: bool = False,
    use_leiden: bool = False,
    show_diff: bool = False,
    max_infer: int = 0,
    include_code: bool = False,
    incremental: bool = False
) -> None
```

## Purpose

Main entry point of [[BuildGraphTool|build_graph.py]]. Orchestrates the full two-pass graph build: collects all wiki pages (and optionally code files), runs {{[[SHA256]]}} change detection for incremental builds, performs Pass 1 wikilink extraction, runs Pass 2 LLM inference (if enabled), applies community detection ([[Louvain]] or [[Leiden]]), generates `graph/graph.json`, renders `graph/graph.html`, and optionally writes a health report.

## Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `infer` | bool | `True` | Run LLM-based semantic inference for implicit edges |
| `open_browser` | bool | `False` | Open graph.html in browser after build |
| `clean` | bool | `False` | Delete checkpoint and force full re-inference |
| `report` | bool | `False` | Generate graph health report |
| `save` | bool | `False` | Save report to `graph/graph-report.md` |
| `use_leiden` | bool | `False` | Use {{[[Leiden]]}} algorithm instead of [[Louvain]] |
| `show_diff` | bool | `False` | Show incremental changes from last build |
| `max_infer` | int | `0` | Limit inference to N pages (0=no limit) |
| `include_code` | bool | `False` | Include project source code in the graph |
| `incremental` | bool | `False` | Only re-parse changed code files (requires `--code`) |

## Connections

- [[ExtractedEdge]] — produced in Pass 1
- [[InferredEdge]] — produced in Pass 2
- [[GraphJSON]] — saved to `graph/graph.json`
- [[GraphHTML]] — saved to `graph/graph.html`
- [[GraphHealthReport]] — generated when `report=True`
- [[CommunityDetection]] — applied to nodes for clustering
- [[CLI]] — invoked via `python tools/build_graph.py [options]`