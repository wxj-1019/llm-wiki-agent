---
title: "parseSseEvent"
type: code_func
tags: [typescript, sse, parser]
sources: [chat-service-sse-client]
last_updated: 2026-05-14
---

# parseSseEvent(eventText: string): WikiChatChunk | null

Parses a single SSE event text into a typed [[WikiChatChunk]].

## Signature
```typescript
function parseSseEvent(eventText: string): WikiChatChunk | null
```

## Parameters
- `eventText: string` — Raw event text containing `data:` lines

## Returns
- `WikiChatChunk` if parsing succeeds, `null` for empty or malformed events

## Parsing logic
1. Extracts all `data: <content>` lines, concatenating multi-line data
2. Trims whitespace
3. Returns `{ type: 'done' }` for `[DONE]` sentinel
4. JSON parses the data string
5. Matches keys (`error`, `chunk`, `sources`, `status`) to discriminate union types
6. Falls through with `console.warn` for unrecognized shapes

## Used by
- [[readSseStream]]