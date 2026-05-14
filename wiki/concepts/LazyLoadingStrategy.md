---
title: "Lazy Loading Strategy"
type: concept
tags: [performance, code-splitting, react, router]
sources: [router-configuration]
last_updated: 2026-05-14
---

**Lazy Loading Strategy** is the code-splitting approach used in the [[LLMWikiViewer|LLM Wiki Viewer]] to optimize initial load time.

## Implementation
- Uses [[React]]'s `React.lazy()` with dynamic `import()`
- Wraps lazy components in a custom `LazyPage` wrapper
- Applied at the route level in [[ReactRouter]] configuration

## Pages Lazy-Loaded
16 heavy or less visited pages: `ChatPage`, `GraphPage`, `SettingsPage`, `UploadPage`, `DashboardPage`, `MindmapPage`, `TimelinePage`, `MCPPage`, `SkillsPage`, `CrawlerPage`, `JarvisPage`, `ApprovalsPage`, `AgentLogPage`, `ToolsRegistryPage`, `PipelineHealthPage`, `IngestJobsPage`, `WebhookManagerPage`

## Pages Loaded Eagerly
Light/always-visited pages: `HomePage`, `BrowsePage`, `SearchPage`, `PageDetailPage`, `LogPage`, `StatusPage`, `NotFoundPage`

## Related
- [[LazyLoading]] entity
- [[router-configuration|Router Configuration]] for the full route list
- Performance optimization pattern common in modern SPAs