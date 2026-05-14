---
title: "useEventStream — SSE EventStream Consumer Hook"
type: source
tags: [frontend, typescript, react, hook, sse, events, reconnection]
date: 2026-05-14
source_file: useEventStream.ts
---

## Summary
The `useEventStream` hook (`useEventStream.ts`) connects to the `/api/events` SSE endpoint and dispatches incoming events to the [[useNotificationStore]] Zustand store. It uses severity-based routing — `critical` and `warning` events become persistent banner alerts (via `addAlert`), while `info`/`success` events become auto-dismiss toasts (via `addNotification`). Auto-reconnects with exponential backoff: 5s → 15s → 30s, capped at 3 retries.

## Key Claims
- **Severity mapping**: `mapSeverity()` maps SSE event types to severity levels: `failed`/`circuit_open` → `critical`, `degraded`/`broken_links` → `warning`, `recovered` → `success`, default → `info`. This is consistent with the [[NotificationDropdown]] component's severity-based styling.
- **Source labeling**: `mapSource()` maps event types to human-readable source labels for banner display: `pipeline.*` → `Pipeline: <job>`, `scraper.*` → `Scraper: <site>`, `wiki.*` → `Wiki Quality`, `graph.*` → `Knowledge Graph`, `system.*` → `System`, `network.*` → `Network`.
- **Action buttons**: `mapAction()` generates `NotificationAction` objects for relevant events: `wiki.broken_links`/`wiki.lint_contradiction` → "运行 Lint" (navigates to `/lint`), `graph.orphan_nodes` → "打开图谱" (navigates to `/graph`), `pipeline.degraded`/`pipeline.failed` → "查看状态" (navigates to `/pipeline`).
- **Exponential backoff reconnection**: Uses a `retryDelays` array [5000, 15000, 30000] milliseconds for 3 max retries. Resets retry count on successful `onopen`. After max retries, sets `connectionState` to `"disconnected"`.
- **Connection state tracking**: Returns `connectionState` (`"connected"` | `"connecting"` | `"disconnected"`) for UI consumption (e.g., the [[Header]] SSE status indicator).
- **Event listener registration**: Registers named SSE event listeners for 10 known event types using `es.addEventListener()`. Unrecognized event types are handled via the generic `onmessage` fallback.
- **Clean disconnection**: `useEffect` cleanup calls `esRef.current?.close()` to prevent memory leaks.

## Key Quotes
> "Auto-reconnects with exponential backoff: 5s → 15s → 30s, max 3 retries." — resilient connection strategy
> "Critical and warning events become persistent banner alerts, info/success become auto-dismiss toasts." — severity-based routing mirrors [[NotificationDropdown]]

## Connections
- [[useNotificationStore]] — store that receives dispatched events (addAlert/addNotification)
- [[NotificationDropdown]] — displays the notifications in the UI
- [[Header]] — consumes `connectionState` for SSE status indicator
- [[SSEStreamProtocol]] — shared SSE streaming pattern across the wiki viewer
- [[LLMWikiViewer]] — the frontend application consuming this hook

## Contradictions
- None identified.