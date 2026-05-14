---
title: "graph.json"
type: entity
tags: [data, graph, knowledge, structure, frontend]
sources: [GraphPageComponent.md, graphpage-interactive-knowledge-graph-component.md]
---

# graph.json

In the context of the LLM Wiki Viewer, `graph.json` is the structured data file that defines the entire interactive knowledge graph visualization. It contains nodes (each representing a wiki entity such as sources, concepts, syntheses, or code modules) and edges (relationships between them), along with metadata including node types, community groupings for color-coding, and edge types distinguishing extracted, inferred, or ambiguous connections. The `GraphPage` component loads `graph.json` via a central wiki store, then renders it using Vis.js — applying physics simulations for layout, enabling node pinning, filtering by type or community, and supporting export operations (PNG, SVG, CSV, GraphML, GEXF). The file's structure directly determines the visual clusters, color scheme, and interactive query capabilities of the knowledge graph interface.