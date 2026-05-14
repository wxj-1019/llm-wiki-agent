---
title: LazyPage Component — Lazy Loading Wrapper
type: code_module
tags: [frontend, typescript, react]
sources: [lazypage-component]
last_updated: 2026-05-14
---

# LazyPage Component (`LazyPage.tsx`)

## Module: `LazyPage.tsx`

### `PageLoader({ label }): ReactElement`

Internal component that renders the animated loading fallback.

- **Parameters**: `label: string` — display name for the loading page (default: `"page"`)
- **Returns**: A full-height centered div containing:
  - An indeterminate progress bar (`motion.div`) that animates width from 0% → 70% → 90% in an infinite loop (2s per cycle, `easeInOut`)
  - A text label: "Loading {label}..."

### `LazyPage({ children }): ReactElement`

Public wrapper for lazy-loaded route components.

- **Parameters**: `children: ReactNode` — the lazy-loaded component tree
- **Returns**: `<Suspense fallback={<PageLoader label="page" />}>{children}</Suspense>`

{{< code/PageSkeleton >}}
{{< entities/FramerMotion >}}
{{< entities/LazyPage >}}
{{< concepts/Lazy Loading Strategy >}}