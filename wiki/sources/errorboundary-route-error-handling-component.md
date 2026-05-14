---
title: "ErrorBoundary — Route Error Handling Component for LLM Wiki Viewer"
type: source
tags: [frontend, typescript, react, error-handling, routing]
date: 2026-05-14
source_file: ErrorBoundary.tsx
---

## Summary
The `ErrorBoundary` component (`ErrorBoundary.tsx`) is a React Router error boundary that catches route-level errors and renders a centered fallback UI. It distinguishes between "page not found" (route errors from `useRouteError()`) and general application errors, displaying an error message code block for the latter. Uses [[FramerMotion]] for entrance animation, [[Lucide|Lucide React]] icons, and [[i18next]] for internationalized labels.

## Key Claims
- **Dual error mode**: Detects route errors via the presence of `statusText` in the error object. Route errors display a "Page Not Found" message (`t('error.pageNotFound')`) with no error details, while general errors show a "Something went wrong" message (`t('error.somethingWrong')`) plus the error message in a scrollable `code` block.
- **Animated entrance**: Top-level `motion.div` fades in and slides up (`opacity: 0, y: 20` → `opacity: 1, y: 0`) over 0.4s. The red error icon container uses rounded-xl styling with `bg-apple-red/10`.
- **Error recovery actions**: Two action buttons in a flex row: (1) "Refresh" ghost button (`[[RefreshCcw]]` icon) calls `window.location.reload()` for a full page reload; (2) "Back to Home" primary button (`[[Home]]` icon) is a `Link` to `"/"` via [[ReactRouter]].
- **Internationalization**: All user-facing strings use `useTranslation()` from [[i18next]] with keys: `error.unknown`, `error.pageNotFound`, `error.somethingWrong`, `error.pageNotFoundDesc`, `error.tryAgain`, `error.refresh`, `action.backToHome`. This is consistent with the existing [[Header]], [[ChatSearchPanel]], and [[SearchPage]] i18n usage in the [[LLMWikiViewer]].
- **Accessibility**: The container has `role="alert"` for screen reader announcement. Error message code block preserves formatting with Tailwind utilities: `whitespace-pre-wrap break-all font-mono text-xs`.
- **Rendering when no error**: `ErrorBoundary` exports as a named function component (not default export). It uses `useRouteError()` which throws if no error is present — thus the component only renders when an error exists at the [[ReactRouter]] route boundary.

## Key Quotes
> "Displays a recovered-alert banner with message and link" — from the observation that the component handles both 404-style and generic errors with appropriate detail levels

## Connections
- [[ReactRouter]] — provides `useRouteError()` and `Link` component; the router (`router.tsx`) uses `errorElement: <ErrorBoundary />` for each route
- [[FramerMotion]] — powers the fade+slide entrance animation
- [[i18next]] — provides internationalized strings via `useTranslation()` hook
- [[Header]] — shares the same i18n pattern and design system
- [[RootLayout]] — the overall app shell that wraps routed content; ErrorBoundary appears when a route component throws
- [[ChatSearchPanel]] — another component using the same i18n pattern
- [[LLMWikiViewer]] — the parent project this component belongs to
- [[PageSkeleton]] — used by [[RootLayout]] for loading state; ErrorBoundary is the error counterpart
- [[HomePage]] — destination of the "Back to Home" link

## Contradictions
- No contradictions with existing wiki content.