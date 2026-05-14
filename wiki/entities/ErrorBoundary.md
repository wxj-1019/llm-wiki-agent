---
title: "ErrorBoundary"
type: entity
tags: [frontend, component, error-handling]
sources: [errorboundary-route-error-handling-component]
last_updated: 2026-05-14
---

# ErrorBoundary

**ErrorBoundary** is a [[React]] component that serves as a route-level error boundary in the [[LLMWikiViewer]] frontend. It is used in the React Router configuration (`router.tsx`) as the `errorElement` for all routes, catching both "page not found" (404) errors and general runtime errors.

## Behavior
- **Page not found**: Shows a centered error panel with [[AlertTriangle]] icon, "Page Not Found" message, and a "Back to Home" link.
- **General errors**: Shows the same layout but includes the error message in a scrollable code block and adds a "Refresh" button that triggers `window.location.reload()`.

## Props
The component reads from `useRouteError()` which returns the error thrown by a route's `loader`, `action`, or component. It does not accept explicit props.

## Dependencies
- [[ReactRouter]] — `useRouteError()`, `Link`
- [[FramerMotion]] — entrance animation
- [[i18next]] — internationalized labels
- [[Lucide]] — icons ([[AlertTriangle]], [[RefreshCcw]], [[Home]])

## Connections
- Used by: [[RootLayout]], [[router-configuration]]
- Related: [[PageSkeleton]] (loading counterpart), [[ChatSearchPanel]] (same i18n pattern)
- Defined in: `ErrorBoundary.tsx`