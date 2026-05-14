---
title: "PhysicsStabilization"
type: concept
tags: [graph, physics, visualization]
sources: [graphpage-interactive-knowledge-graph-component]
last_updated: 2026-05-14
---

# PhysicsStabilization

**PhysicsStabilization** refers to the process in [[VisJS]] where a force-directed physics engine iteratively adjusts node positions until the network reaches a low-energy (stable) state. [[GraphPage]] uses this by configuring the physics solver with `stabilizationProgress` callback to provide a visual progress bar (`stabilizing` state). The progress bar auto-hides when stabilization completes. Users can freeze/unfreeze physics via a button, and editing mode disables physics to allow manual node positioning.

## Connections
- [[GraphPage]] — user of this concept
- [[VisJS]] — provides the physics engine
- [[LayoutPersistence]] — saves positions after stabilization