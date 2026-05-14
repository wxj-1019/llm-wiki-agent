---
title: "VisJS"
type: entity
tags: [library, javascript, visualization, graph]
sources: [build-graph-tool-knowledge-graph-builder]
last_updated: 2026-05-14
---

[[VisJS]] (vis-network) is a JavaScript library for dynamic, interactive network visualization. In the [[BuildGraphTool|Build Graph Tool]], vis.js is used to render the knowledge graph as a self-contained HTML page (`graph/graph.html`) with physics simulation, node dragging, zoom, and community-based color highlighting. The CDN-loaded library eliminates the need for a server.

## Connections
- [[BuildGraphTool]] — generates vis.js-based HTML visualization
- [[GraphHTML]] — the interactive HTML file produced by the build tool
- [[LLMWikiViewer]] — the frontend that also uses vis-network for graph display