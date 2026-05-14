---
title: "PageTransition"
type: code_func
tags: [frontend, animation, component]
sources: [root-layout-main-application-layout-component]
last_updated: 2026-05-14
---

# `PageTransition`

**File:** `wiki-viewer/src/components/layout/RootLayout.tsx` (line 32)

**Signature:** `function PageTransition({ pathname, isGraphPage, children }: { pathname: string; isGraphPage: boolean; children: React.ReactNode }): React.ReactElement`

## Purpose
Wraps page content in a [[FramerMotion]] animated `<motion.div>` with route-specific animation variants from [[GetPageAnimation]].

## Parameters
- `pathname: string` — current route path
- `isGraphPage: boolean` — flag for graph page (unused directly, but passed for potential future use)
- `children: React.ReactNode` — page content to animate

## Behavior
Creates a `<motion.div className="h-full">` with `initial`, `animate`, `exit`, and `transition` props derived from [[GetPageAnimation]]. Used inside [[AnimatePresence]] `mode="wait"`.

## Related
- [[RootLayout]]
- [[GetPageAnimation]]
- [[AdaptivePageTransitions]]