---
title: "GraphData"
type: entity
tags: [frontend, graph, type]
sources: [wikistore-zustand-global-state-store]
last_updated: 2026-05-14
---

GraphData is the TypeScript interface representing the full knowledge graph structure, containing arrays of [[GraphNode]] objects and edge objects. It is fetched from the API server and cached in localStorage with a 1-hour TTL by [[WikiStore]].