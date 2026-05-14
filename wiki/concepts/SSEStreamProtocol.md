---
title: "SSE Stream Protocol"
type: concept
tags: [frontend, streaming, protocol]
sources: [chat-service-sse-client]
last_updated: 2026-05-14
---

# SSE Stream Protocol

The SSE (Server-Sent Events) stream protocol is the event-driven mechanism used by the [[APIServer]] to stream chat responses to the [[WikiViewer]] frontend. Implemented in [[chatService]] via [[readSseStream]], it follows these conventions:

- Events are delimited by `\n\n`
- Each event contains `data: <json>` lines
- `[DONE]` sentinel signals normal stream termination
- Parsed into [[WikiChatChunk]] discriminated union types: `chunk`, `sources`, `status`, `error`, `done`
- 60-second timeout enforced via `STREAM_TIMEOUT_MS`
- Supports cancellation via `AbortSignal`
- Backpressure handled via async generator yielding

Related: [[readSseStream]], [[parseSseEvent]], [[chatWithWikiStream]], [[chatWithLLMStream]]