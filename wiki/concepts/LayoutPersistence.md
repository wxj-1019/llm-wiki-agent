---
title: "LayoutPersistence"
type: concept
tags: [graph, layout, persistence]
sources: [graphpage-interactive-knowledge-graph-component]
last_updated: 2026-05-14
---

# LayoutPersistence

**LayoutPersistence** describes the mechanism by which [[GraphPage]] saves and restores node positions after user interaction. After the physics engine stabilizes, the component reads each node's `x` and `y` coordinates and stores them in [[LocalStorage]] under the `wiki-graph-positions` key. A "Save Layout" button allows the user to freeze the current layout (disabling physics) by saving positions. When the graph reloads, the component checks for saved positions and restores them, preventing the physics engine from re-stabilizing from scratch.

## Connections
- [[GraphPage]] — implements this pattern
- [[LocalStorage]] — storage backend
- [[VisJS]] — provides node position data