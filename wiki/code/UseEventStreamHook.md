---
title: "useEventStream — SSE EventStream Consumer Hook"
type: code_func
tags: [frontend, typescript, react, hook, sse, events]
sources: [useeventstream-sse-eventstream-consumer-hook]
---

## Signature
```typescript
export function useEventStream(navigate: NavigateFunction): { connectionState: ConnectionState }
```

## Purpose
Connects to `/api/events` SSE endpoint, dispatches events to [[useNotificationStore]] with severity-based routing, and returns connection state.

## Parameters
- `navigate`: [[ReactRouter]] `NavigateFunction` for action button navigation

## Returns
- `connectionState`: `"connected"` | `"connecting"` | `"disconnected"`

## Internal State
- `esRef` — mutable ref to the `EventSource` instance
- `retryCount` — tracks reconnection attempts (max 3)
- `connectionState` — current connection status

## Dependencies
- [[useNotificationStore]] for `addAlert` and `addNotification`
- `retryDelays` array: [5000, 15000, 30000] ms
- 10 registered event types: `pipeline.degraded`, `pipeline.failed`, `scraper.degraded`, `scraper.circuit_open`, `wiki.broken_links`, `wiki.lint_contradiction`, `graph.orphan_nodes`, `system.recovered`, `network.retry_status`, `network.retry_exhausted`

## Internal Functions
- `mapSeverity(eventType)`: maps SSE event types to severity levels
- `mapSource(eventType, data)`: maps event types to human-readable source labels
- `mapAction(eventType, data, navigate)`: builds `NotificationAction` for banner buttons

## Related Code
- [[NotificationDropdown]] — displays the notifications
- [[Header]] — consumes `connectionState` for status indicator