---
title: "GraphPage"
type: entity
tags: [frontend, component, graph]
sources: [graphpage-interactive-knowledge-graph-component]
last_updated: 2026-05-14
---

# GraphPage

`GraphPage` is the interactive knowledge graph visualization component in the [[LLMWikiViewer|LLM Wiki Viewer]] frontend. Built on [[VisJS|vis-network]], it renders the wiki's knowledge graph as an interactive network visualization.

## Key Features

- **Adaptive theming**: Colors read from CSS custom properties at runtime, adapting to light/dark modes without hardcoded palettes.
- **Three edge types**: `EXTRACTED` (solid blue), `INFERRED` (solid gray), `AMBIGUOUS` (dashed gray).
- **Physics engine**: vis-network's built-in physics solver with stabilization progress bar and user-controllable freeze/unfreeze.
- **Node interaction**: Single-click to select (highlights direct connections), double-click to navigate to the wiki page.
- **Type and community filtering**: Toggle node visibility by type (`source`, `entity`, `concept`, `synthesis`, `code`) or community group.
- **Layout persistence**: Saves/restores node positions via [[LocalStorage]] (`wiki-graph-positions`).
- **Edit mode**: Enables node dragging with physics disabled; positions saved on exit.
- **Export**: Supports PNG, SVG, CSV (node/edge lists), GraphML, and GEXF export formats.
- **Query panel**: Natural language queries against the graph via API endpoint.
- **Rebuild capability**: Triggers graph data regeneration with loading indicator.
- **First-run onboarding**: Step-by-step overlay introducing zoom, drag, click, double-click, and legend.
- **Real-time statistics panel**: Node count, edge count, community count, and graph density.

## Connections
- [[VisJS]] — underlying graph rendering library
- [[graph.json]] — data source
- [[LocalStorage]] — layout persistence
- [[ReactRouter]] — navigation
- [[PageDetailPage]] — target for node navigation
- [[LLMWikiViewer]] — parent application