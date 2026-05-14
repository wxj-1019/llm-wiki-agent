---
title: "NetworkX"
type: entity
tags: [library, python, graph, network]
sources: [build-graph-tool-knowledge-graph-builder]
last_updated: 2026-05-14
---

[[NetworkX]] is a Python library for the creation, manipulation, and study of complex networks and graphs. It provides graph data structures, algorithms for network analysis (like [[Louvain]] community detection), and integration with graph visualization tools. In the [[BuildGraphTool|Build Graph Tool]], NetworkX is used for graph construction, node/edge management, community detection via Louvain, and generating the graph health report.

## Connections
- [[BuildGraphTool]] — uses NetworkX for graph analysis
- [[Louvain]] — community detection algorithm from NetworkX
- [[IGraph]] — alternative graph library with Leiden support