---
title: "GraphPage — Interactive Knowledge Graph Visualization Component"
type: source
tags: [frontend, typescript, react, graph, visualization]
date: 2026-05-14
source_file: GraphPage.tsx
---

## Summary
The `GraphPage` component (`GraphPage.tsx`) is a full-featured interactive knowledge graph visualization for the [[LLMWikiViewer|LLM Wiki Viewer]] frontend. Built on [[VisJS|vis-network]], it renders nodes colored by type (`source`, `entity`, `concept`, `synthesis`, `code`) and community group from [[graph.json]] data, with support for interactive navigation, type/community filtering, node pinning, physics stabilization, layout saving/restoring, export (PNG/SVG/CSV/GraphML/GEXF), a graph query panel, and edge type visual differentiation (extracted vs inferred vs ambiguous). The component also includes a first-run onboarding overlay and real-time statistics panel.

## Key Claims
- **Dark-mode optimized visualization**: Node/edge colors read from CSS custom properties (`--apple-blue`, `--apple-green`, etc.) at runtime, adapting to theme without hardcoded palettes.
- **Three edge types visually distinguished**: `EXTRACTED` (solid, blue, width 1.5), `INFERRED` (solid, gray, width 0.8), `AMBIGUOUS` (dashed, gray, width 0.8).
- **Physics engine with stabilization**: Uses vis-network's built-in physics solver with `stabilizationProgress` callback for a visual progress bar (`stabilizing` state) that auto-hides when stabilization iterations complete.
- **Node interaction**: Click selects a node highlighting its direct connections; double-click navigates to the wiki page via `[[ReactRouter|React Router]]` using [[PageDetailPage]] paths from `getPagePath()`.
- **Type filtering**: Toggles for `source`, `entity`, `concept`, `synthesis` (and optionally `code`) via [[GraphHealthReport|graph type filter]] buttons; community filter dropdown built from <code>group</code> field on nodes.
- **Layout persistence**: Node positions saved to/synced from [[LocalStorage]] under `wiki-graph-positions`; a "Save Layout" button freezes current positions.
- **Edit mode**: Toggleable via "Edit" button — enables node dragging with physics disabled, positions saved on exit.
- **Export capabilities**: PNG (via `canvas.toDataURL` download), SVG (via VisJS `getSVG`), CSV/node/edge lists, GraphML/CSV text generation, and GraphML download.
- **Graph query panel**: Sends natural language queries to `/api/graph/query` via [[GraphHealthReport|graph query API]] with loading state and result display.
- **Rebuild**: Rebuilds graph data by calling `/api/graph/rebuild` with loading spinner.
- **First-run onboarding**: A step-by-step overlay introducing zoom, drag, click, double-click, and legend with keyboard dismiss (Escape) and "Got it" button.
- **Real-time stats panel**: [[GraphHealthReport|GraphStats]] sub-component showing node count, edge count, community count, and graph density.
- **Community filter**: A dropdown that lists all communities by ID with node count, filterable by multi-select; only show when `showCommunityFilter` is toggled.

## Key Quotes
> "Node/edge colors read from CSS custom properties at runtime" — adaptive theming
> "physics solver with stabilizationProgress callback for a visual progress bar" — user feedback during layout

## Connections
- [[VisJS]] — vis-network library for graph rendering
- [[graph.json]] — data source containing nodes and edges
- [[LocalStorage]] — layout persistence via `wiki-graph-positions` key
- [[ReactRouter]] — navigation to page detail via double-click
- [[PageDetailPage]] — target route for node navigation via `getPagePath()`
- [[GraphHealthReport]] — related concept for graph analysis and type filtering
- [[LLMWikiViewer]] — the parent application
- [[LLMWikiViewer]] — frontend ecosystem

## Contradictions
- (none identified)
