---
title: "getPageAnimation"
type: code_func
tags: [frontend, animation, utility]
sources: [root-layout-main-application-layout-component]
last_updated: 2026-05-14
---

# `getPageAnimation`

**File:** `wiki-viewer/src/components/layout/RootLayout.tsx` (line 22)

**Signature:** `function getPageAnimation(pathname: string): { initial: object, animate: object, exit: object, transition: object }`

## Purpose
Returns animation variants for [[PageTransition]] based on route pathname. Implements the [[AdaptivePageTransitions]] pattern.

## Behavior
- If `pathname === '/graph'` or starts with `/mindmap`: opacity + scale (zoom) animation, `duration: 0.25`
- If pathname starts with `/upload`, `/chat`, `/settings`, `/status`, `/mcp`, `/skills`, `/dashboard`, `/crawler`, or `/timeline`: opacity + horizontal slide animation, `duration: 0.2`
- Default: opacity + vertical slide animation, `duration: 0.2`

## Related
- [[RootLayout]]
- [[PageTransition]]
- [[AdaptivePageTransitions]]