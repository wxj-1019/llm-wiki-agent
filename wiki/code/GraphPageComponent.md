---
title: "GraphPage"
type: code_module
tags: [frontend, graph, visualization, react]
sources: [graphpage-interactive-knowledge-graph-component]
last_updated: 2026-05-14
---

# GraphPage (Component)

Main graph visualization page component for the [[LLMWikiViewer|LLM Wiki Viewer]].

## Imports
- `vis-network/standalone` — core graph rendering ([[VisJS]])
- `lucide-react` — icons
- `react-router-dom` — navigation ([[ReactRouter]])
- `framer-motion` — animations
- `@/stores/wikiStore` — state: graph data, loading, error
- `@/stores/notificationStore` — notification system
- `@/services/dataService` — API: `exportGraph()`, `queryGraph()`
- `@/hooks/useDocumentTitle` — document title sync
- `@/components/ChipLoader` — loading spinner
- `@/lib/safeStorage` — safe localStorage get/set
- `@/lib/wikilink` — page path resolution

## Key Behavior
- Renders a full-page interactive knowledge graph using [[VisJS]] Network.
- Initializes once (via `initRef` guard) by calling `useWikiStore` state initialization.
- Builds vis-formatted data from raw graph JSON nodes/edges.
- Updates datasets incrementally when graph data changes, instead of destroying and recreating.
- Handles stabilization progress for a visual progress bar.
- Provides first-run onboarding overlay with keyboard dismiss.

## Connections
- [[GraphStats]] — embedded sub-component for statistics display
- [[graph.json]] — data source
- [[LocalStorage]] — layout persistence
- [[PageDetailPage]] — target route for double-click node navigation
- [[GraphHealthReport]] — related concept for graph analysis
- [[VisJS]] — underlying library
- [[Networks]] — graph theory base