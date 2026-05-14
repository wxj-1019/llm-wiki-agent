---
title: "GraphJSON"
type: entity
tags: [file, data, graph, json]
sources: [build-graph-tool-knowledge-graph-builder]
last_updated: 2026-05-14
---

[[GraphJSON]] is the node/edge data file at `graph/graph.json` produced by the [[BuildGraphTool|Build Graph Tool]]. It contains two arrays — `nodes` (with id, label, type, community, color, size, source fields) and `edges` (with from, to, type, label, color, confidence fields). The data is SHA256-cached for incremental builds. This file serves as the data source for generating `graph/graph.html` and for the [[LLMWikiViewer]] graph page.

## Connections
- [[BuildGraphTool]] — produces this file
- [[GraphHTML]] — visualization generated from this data
- [[LLMWikiViewer]] — frontend that reads this data for its graph display