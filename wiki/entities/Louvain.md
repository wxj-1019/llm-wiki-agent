---
title: "Louvain"
type: entity
tags: [algorithm, community-detection, graph]
sources: [build-graph-tool-knowledge-graph-builder]
last_updated: 2026-05-14
---

[[Louvain]] is a community detection algorithm for large networks. It optimizes modularity through a greedy hierarchical approach, first locally optimizing community assignments then aggregating communities into a super-graph for the next pass. In the [[BuildGraphTool|Build Graph Tool]], Louvain clustering is used to group related wiki pages into topical communities for visualization and analysis. Available via `networkx.algorithms.community.louvain_communities`.

## Connections
- [[Leiden]] — higher-quality alternative community detection algorithm
- [[CommunityDetection]] — the general concept of finding clusters in a graph
- [[NetworkX]] — the Python library providing the Louvain implementation