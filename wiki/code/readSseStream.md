---
title: "readSseStream"
type: code_func
tags: [typescript, sse, streaming, async]
sources: [chat-service-sse-client]
last_updated: 2026-05-14
---

# readSseStream(res: Response, signal?: AbortSignal): AsyncGenerator<WikiChatChunk, void, unknown>

Core async generator that reads a fetch Response body as an SSE stream, yielding typed [[WikiChatChunk]] events.

## Signature
```typescript
async function* readSseStream(
  res: Response,
  signal?: AbortSignal
): AsyncGenerator<WikiChatChunk, void, unknown>
```

## Parameters
- `res: Response` — Fetch API Response with readable body
- `signal?: AbortSignal` — Optional abort signal for cancellation

## Yields
- `WikiChatChunk` — typed events as they arrive

## Errors
- Throws if `res.body` is null
- Yields `{ type: 'error', error: 'Response timed out...' }` on 60s timeout
- On `done` or `error` chunks, terminates the generator

## Timeout handling
- 60s (`STREAM_TIMEOUT_MS`) no-activity timeout cancels the reader
- Timeout resets on each successful read

## Cleanup
- Clears timeout on completion/error
- Removes abort event listener
- Releases reader lock in `finally` block

## Used by
- [[chatWithWikiStream]]
- [[chatWithLLMStream]]