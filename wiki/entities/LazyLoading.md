---
title: "LazyLoading"
type: entity
tags: [performance, react, code-splitting, optimization]
sources: [router-configuration]
last_updated: 2026-05-14
---

**Lazy Loading** is a performance optimization technique used in the [[LLMWikiViewer|LLM Wiki Viewer]] via `React.lazy()`. Heavy or less frequently visited pages are split into separate JavaScript bundles and loaded on demand.

- 16 pages are lazy-loaded in [[router-configuration|Router Configuration]]
- Uses a custom [[LazyPage]] wrapper component for consistent loading state
- Significant initial bundle size reduction achieved

### Lazy-loaded pages:
`ChatPage`, `GraphPage`, `SettingsPage`, `UploadPage`, `DashboardPage`, `MindmapPage`, `TimelinePage`, `MCPPage`, `SkillsPage`, `CrawlerPage`, `JarvisPage`, `ApprovalsPage`, `AgentLogPage`, `ToolsRegistryPage`, `PipelineHealthPage`, `IngestJobsPage`, `WebhookManagerPage`