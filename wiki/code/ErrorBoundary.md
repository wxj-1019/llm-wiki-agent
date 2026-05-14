---
title: "ErrorBoundary"
type: code_module
tags: [frontend, typescript, react, error-handling]
sources: [errorboundary-route-error-handling-component]
file: frontend/src/ErrorBoundary.tsx
last_updated: 2026-05-14
---

# ErrorBoundary (`ErrorBoundary.tsx`)

A React Router error boundary component that renders a centered fallback UI on route-level errors.

## Signature

```typescript
export function ErrorBoundary(): JSX.Element
```

## Dependencies
- `react-router-dom`: `useRouteError`, `Link`
- `lucide-react`: `Home`, `AlertTriangle`, `RefreshCcw`
- `framer-motion`: `motion`
- `react-i18next`: `useTranslation`

## Parameters
No explicit parameters — reads error from [[useRouteError]] hook.

## Returns
A `div` with role="alert" containing:
- Centered error icon ([[AlertTriangle]]) in a rounded-xl red container
- Title text: route error → `t('error.pageNotFound')`, else `t('error.somethingWrong')`
- Description: route error → `t('error.pageNotFoundDesc')`, else `t('error.tryAgain')`
- Error code block (only for non-route errors): scrollable, monospace, preserves whitespace
- Action buttons: [[RefreshCcw]] (reload page) + [[Home]] (link to `/`)

## Related Pages
- [[ReactRouter]] — route framework
- [[ErrorBoundary]] — component entity page
- [[RouteErrorBoundary]] — concept page
- [[RootLayout]] — consumer of ErrorBoundary via router
- [[router-configuration]] — route definitions