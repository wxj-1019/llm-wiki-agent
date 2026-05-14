---
title: "WikiChatChunk"
type: entity
tags: [frontend, sse, chat]
sources: [chat-service-sse-client]
last_updated: 2026-05-14
---

# WikiChatChunk

`WikiChatChunk` is a discriminated union type representing a single event from the SSE streaming chat protocol in the [[APIServer]] → [[ChatService]] data flow. Each chunk has a `type` discriminant:

- `{ type: 'chunk'; content: string }` — incremental text token
- `{ type: 'sources'; sources: WikiChatSource[] }` — citation sources
- `{ type: 'status'; status: string }` — intermediate status update
- `{ type: 'error'; error: string }` — fatal error
- `{ type: 'done' }` — stream termination

Used as the yield type for [[readSseStream]], [[chatWithWikiStream]], and [[chatWithLLMStream]].