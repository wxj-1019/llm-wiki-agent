---
title: "React Router"
type: entity
tags: [router, frontend, react, typescript]
sources: [router-configuration]
last_updated: 2026-05-14
---

**React Router** is a standard routing library for [[React]] applications. In the [[LLMWikiViewer|LLM Wiki Viewer]], version 7's `createBrowserRouter` API is used to define 26 routes with nested layouts, lazy loading, and per-route error boundaries. Routes use typed URL patterns (`/s/:slug` for sources, `/e/:name` for entities, `/c/:name` for concepts, `/y/:slug` for syntheses).

- Used in [[router-configuration|Router Configuration]] for all route definitions
- Enables lazy loading via `React.lazy()` for 16 pages
- Integrates with [[ErrorBoundary]] for graceful error recovery