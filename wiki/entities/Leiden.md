---
title: "Leiden"
type: entity
tags: [algorithm, community-detection, graph]
sources: [build-graph-tool-knowledge-graph-builder]
last_updated: 2026-05-14
---

[[Leiden]] is a community detection algorithm that improves upon the [[Louvain]] algorithm. It guarantees well-connected communities and is often faster and produces higher-quality clusters. In the [[BuildGraphTool|Build Graph Tool]], Leibniz is available optionally via `python-igraph` + `leidenalg`. Activated with the `--leiden` flag.

## Connections
- [[Louvain]] — predecessor algorithm that Leiden improves upon
- [[CommunityDetection]] — the general concept of finding clusters in a graph
- [[IGraph]] — the Python library required for Leiden algorithm
- [[Leidenalg]] — the Python package implementing the Leiden algorithm