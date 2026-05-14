---
title: "GraphStats"
type: entity
tags: [frontend, component, graph, ui]
sources: [graphpage-interactive-knowledge-graph-component]
last_updated: 2026-05-14
---

# GraphStats

`GraphStats` is a sub-component of [[GraphPage]] that displays real-time knowledge graph statistics: node count, edge count, community count, and graph density. It is collapsible via a toggle button. Includes a `useTranslation` hook for i18n support.

## Connections
- [[GraphPage]] — parent component
- [[GraphHealthReport]] — related concept for graph analysis