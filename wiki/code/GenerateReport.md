---
title: "generate_report() — Graph Health Report Generator"
type: code_func
tags: [graph, report, health]
sources: [build-graph-tool-knowledge-graph-builder]
last_updated: 2026-05-14
---

## Signature

```python
def generate_report(
    nodes: list[dict],
    edges: list[dict],
    communities: list[set],
    pages: Optional[list[Path]] = None
) -> str
```

## Purpose

Generates a structured graph health report from the built graph data. Computes edge/node ratio, orphan node percentage, community count, link density. Identifies orphan nodes (zero connections), god nodes (degree > μ+2σ), fragile bridges (single-edge community connections), and phantom hubs (missing pages referenced by 2+ pages).

## Parameters

| Parameter | Type | Description |
|---|---|---|
| `nodes` | list[dict] | List of node objects with id, type, community |
| `edges` | list[dict] | List of edge objects with from, to, type |
| `communities` | list[set] | Sets of node IDs per community |
| `pages` | Optional[list[Path]] | Full list of wiki page paths for phantom hub detection |

## Returns

Formatted string report suitable for saving to `graph/graph-report.md` or printing to stdout.

## Connections

- [[BuildGraphTool]] — invokes this function via `--report`
- [[GraphHealthReport]] — the concept it implements
- [[GodNodes]] — hubs with disproportionate connectivity
- [[FragileBridges]] — community pairs with minimal connection
- [[PhantomHubs]] — missing pages referenced by existing wikilinks