---
title: "LazyPage — Lazy Loading Page Component for LLM Wiki Viewer"
type: source
tags: [frontend, typescript, react, lazy-loading, animation]
date: 2026-05-14
source_file: LazyPage.tsx
---

## Summary
The `LazyPage` component (`LazyPage.tsx`) provides a lazy-loading wrapper for route-level code splitting in the [[LLMWikiViewer]] frontend. It wraps children in a [[Suspense]] boundary with a custom animated `PageLoader` fallback that features an indeterminate progress bar animation built with [[FramerMotion]].

## Key Claims
- **Animated loading state**: `PageLoader` renders a fullscreen centered loading indicator with a "progress bar" animation that loops 0%→70%→90% infinitely via `motion.div` with `repeat: Infinity` and `repeatType: 'loop'`. This simulates progress without knowing actual load progress.
- **Suspense integration**: `LazyPage` wraps its `children` in a [[React]] `Suspense` boundary; when child components are code-split via `React.lazy()`, the `PageLoader` fallback is shown during chunk fetch and evaluation.
- **Minimal surface area**: The component is a thin wrapper with two exports (`PageLoader` internal, `LazyPage` public), 0 configuration props beyond `children`, and no external dependencies beyond `react` and `framer-motion`.

## Key Quotes
> "Progress bar animation: 0%→70%→90% looping infinitely" — simulates loading without real progress data

## Connections
- [[FramerMotion]] — powers both the progress bar animation (animate/motion.div) and container slide/fade
- [[RootLayout]] — likely consumer of `LazyPage` for lazy-loading route components
- [[LazyLoadingStrategy]] — the wiki's overall lazy loading approach
- [[router-configuration]] — routes that use `LazyPage` for code-split page components
- [[PageSkeleton]] — alternative loading display for full-page skeleton

## Contradictions
- No contradictions with existing wiki content.
