---
title: "useRouteError"
type: entity
tags: [frontend, react-router, hook]
sources: [errorboundary-route-error-handling-component]
last_updated: 2026-05-14
---

# useRouteError

**useRouteError** is a [[ReactRouter]] hook that returns the error thrown by a route's `loader`, `action`, or component. In the [[LLMWikiViewer]], it is used by [[ErrorBoundary]] to detect whether the error is a route error (has `statusText`) or a generic runtime error.