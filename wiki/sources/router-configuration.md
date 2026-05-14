---
title: "Router Configuration — React Router Setup for LLM Wiki Viewer"
type: source
tags: [router, react-router, typescript, frontend, lazy-loading]
date: 2026-05-14
source_file: router.tsx
---

## Summary
The `router.tsx` module defines the complete route structure for the [[LLMWikiViewer|LLM Wiki Viewer]] frontend using [[ReactRouter|React Router]] version 7's `createBrowserRouter`. It organizes ~25 routes under a [[RootLayout]] shell, implements lazy loading for heavy or less frequently visited pages via `React.lazy()`, and uses URL conventions (`/s/:slug`, `/e/:name`, `/c/:name`, `/y/:slug`) for different wiki content types. The router also provides a catch-all `NotFoundPage`, per-route `ErrorBoundary` wrapping, and redirect from `/chat` to `/search`.

## Key Claims
- **26 routes** defined under the root `'/'` path, all nested inside `RootLayout`.
- **Lazy loading** via `React.lazy()` for 16 pages: `ChatPage`, `GraphPage`, `SettingsPage`, `UploadPage`, `DashboardPage`, `MindmapPage`, `TimelinePage`, `MCPPage`, `SkillsPage`, `CrawlerPage`, `JarvisPage`, `ApprovalsPage`, `AgentLogPage`, `ToolsRegistryPage`, `PipelineHealthPage`, `IngestJobsPage`, `WebhookManagerPage`.
- **Typed paths** for wiki content: `/s/:slug` (sources), `/e/:name` (entities), `/c/:name` (concepts), `/y/:slug` (syntheses).
- **Error handling**: Each route has its own `ErrorBoundary`, plus a root-level one on the parent route.
- **URL normalization**: `/chat` redirects to `/search` to avoid the deprecated legacy chat URL.
- **404 handling**: `'*'` catch-all renders `NotFoundPage`.
- **Lazy wrapper**: Uses a custom `LazyPage` component for consistent loading state presentation on lazy routes.

## Connections
- [[RootLayout]] — parent layout component wrapping all routes
- [[ErrorBoundary]] — used on every route for error fallback
- [[LazyPage]] — component wrapper for lazy-loaded pages
- [[PageDetailPage]] — renders source/entity/concept/synthesis detail views via URL param
- [[HomePage]], [[BrowsePage]], [[SearchPage]], [[LogPage]] — static (non-lazy) pages
- [[APIServer]] — backend that serves the wiki content these routes consume

## Key Quotes
> "Lazy-load heavy / less frequently visited pages" — code comment indicating performance optimization strategy

## Contradictions
- None identified.