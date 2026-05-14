---
title: "AdaptiveGraphTheming"
type: concept
tags: [graph, theming, css, visualization]
sources: [graphpage-interactive-knowledge-graph-component]
last_updated: 2026-05-14
---

# AdaptiveGraphTheming

**AdaptiveGraphTheming** is a design pattern used by [[GraphPage]] where node colors, edge colors, and text colors are derived from CSS custom properties at runtime rather than hardcoded. Functions like `getAppleNodePalette()`, `getThemeColors()`, and `getComputedColor()` read from `--apple-blue`, `--apple-green`, etc., ensuring the graph visualization automatically adapts to the application's light/dark mode without requiring separate palettes or re-rendering. This approach prevents visual inconsistencies when the theme changes and allows for easy customization via CSS variables.

## Connections
- [[GraphPage]] — implements this pattern
- [[VisJS]] — consumes the computed colors