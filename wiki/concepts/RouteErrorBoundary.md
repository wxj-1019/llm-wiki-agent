---
title: "RouteErrorBoundary"
type: concept
tags: [frontend, error-handling, routing, react-router]
sources: [errorboundary-route-error-handling-component]
last_updated: 2026-05-14
---

# RouteErrorBoundary

The **RouteErrorBoundary** pattern in [[ReactRouter]] v6+ allows each route to specify an `errorElement` component that renders when a route-level error occurs (from a `loader`, `action`, or component render). This replaces the traditional React class-component `ErrorBoundary` with a declarative, route-scoped approach.

## Implementation in LLM Wiki Viewer

In [[router-configuration]], every route object includes `errorElement: <ErrorBoundary />`. The [[ErrorBoundary]] component uses `useRouteError()` to access the error and differentiate between:
- **Route errors** (e.g., 404): shown with a simple "Page Not Found" message
- **Runtime errors**: shown with the error message inline and a refresh option

## Benefits
- **Granular error handling**: Each route can have its own error boundary, preventing a crash in one route from taking down the entire app
- **Smooth fallback**: The animated [[FramerMotion]] entrance and consistent styling (Apple glassmorphism design system) provide a polished user experience even when things go wrong
- **Internationalized**: All error messages use [[i18next]] keys, ensuring localization consistency

## Connections
- [[ErrorBoundary]] — concrete implementation
- [[ReactRouter]] — parent framework providing `useRouteError()` and `errorElement`
- [[PageSkeleton]] — the loading counterpart in the app shell