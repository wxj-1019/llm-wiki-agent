---
title: "SSE Event Stream Pattern"
type: concept
tags: [frontend, sse, events, pattern]
sources: [useeventstream-sse-eventstream-consumer-hook]
---

A frontend architecture pattern for consuming Server-Sent Events (SSE) streams in React applications. Key characteristics:

- **Severity-based event routing**: Events are classified by severity (`critical`/`warning`/`success`/`info`) and dispatched to appropriate UI channels (persistent banners vs. auto-dismiss toasts).
- **Exponential backoff reconnection**: Implements retry delays [5s, 15s, 30s] for auto-reconnection, with a configurable max retry limit (default 3).
- **Named event listeners**: Registers specific handlers for known event types via `EventSource.addEventListener()`, with a fallback `onmessage` for untyped events.
- **Connection state tracking**: Exposes a `ConnectionState` union (`"connected"` | `"connecting"` | `"disconnected"`) for real-time UI status indicators.

This pattern is used by the [[useEventStream]] hook and generalizes the [[SSEStreamProtocol]] used for streaming chat responses.