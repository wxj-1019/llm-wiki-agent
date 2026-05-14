---
title: "router — Wiki Viewer Route Configuration"
type: code_module
source_file: router.tsx
tags: [router, react-router, typescript, frontend]
sources: [router-configuration]
last_updated: 2026-05-14
---

## Signature
`const router = createBrowserRouter([...])`

## Purpose
Defines the complete route table for the [[LLMWikiViewer|LLM Wiki Viewer]] frontend, mapping URL paths to React components with nested layout, error boundaries, and lazy loading.

## Key Imports
- `createBrowserRouter` from [[ReactRouter]] ('react-router-dom')
- `RootLayout`, `HomePage`, `BrowsePage`, `PageDetailPage`, `SearchPage`, `LogPage`, `StatusPage`, `NotFoundPage` (eager)
- `ErrorBoundary` for error recovery
- 16 lazy-loaded pages via `React.lazy()`
- `LazyPage` wrapper component

## Routes
| Path | Component | Lazy? |
|---|---|---|
| `/` | HomePage | No |
| `/browse` | BrowsePage | No |
| `/s/:slug` | PageDetailPage (type='source') | No |
| `/e/:name` | PageDetailPage (type='entity') | No |
| `/c/:name` | PageDetailPage (type='concept') | No |
| `/y/:slug` | PageDetailPage (type='synthesis') | No |
| `/graph` | GraphPage | Yes |
| `/chat/:sessionId` | ChatPage | Yes |
| `/search` | SearchPage | No |
| `/log` | LogPage | No |
| `/settings` | SettingsPage | Yes |
| `/upload` | UploadPage | Yes |
| `/status` | StatusPage | No |
| `/mcp` | MCPPage | Yes |
| `/skills` | SkillsPage | Yes |
| `/dashboard` | DashboardPage | Yes |
| `/mindmap/:slug` | MindmapPage | Yes |
| `/timeline` | TimelinePage | Yes |
| `/crawler` | CrawlerPage | Yes |
| `/jarvis` | JarvisPage | Yes |
| `/approvals` | ApprovalsPage | Yes |
| `/agent-log` | AgentLogPage | Yes |
| `/tools` | ToolsRegistryPage | Yes |
| `/pipeline` | PipelineHealthPage | Yes |
| `/jobs` | IngestJobsPage | Yes |
| `/webhooks` | WebhookManagerPage | Yes |
| `*` | NotFoundPage (catch-all 404) | No |

## Special Behavior
- `/chat` redirects to `/search` (legacy URL migration)
- Each route has its own `ErrorBoundary` in addition to the root-level one
- Lazy routes are wrapped in `LazyPage` for consistent loading UI

## Related
- [[router-configuration|Router Configuration]] source page
- [[ReactRouter]]
- [[LazyLoading]]
- [[PageDetailPage]]
- [[RootLayout]]