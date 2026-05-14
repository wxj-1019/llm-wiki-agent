---
title: "CommunityDetection"
type: entity
tags: [algorithm, graph, analysis]
sources: [build-graph-tool-knowledge-graph-builder]
last_updated: 2026-05-14
---

Community detection is the task of grouping nodes in a graph into clusters (communities) where intra-cluster connections are dense and inter-cluster connections are sparse. In the [[BuildGraphTool|Build Graph Tool]], community detection is performed using either the [[Louvain]] algorithm (via `networkx`) or the [[Leiden]] algorithm (via `python-igraph` + `leidenalg`) to find topic clusters among wiki pages.

## Connections
- [[Louvain]] — the default community detection algorithm
- [[Leiden]] — the higher-quality optional alternative
- [[BuildGraphTool]] — uses community detection for graph analysis and coloring