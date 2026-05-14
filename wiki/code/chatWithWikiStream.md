---
title: "chatWithWikiStream"
type: code_func
tags: [typescript, chat, wiki, sse]
sources: [chat-service-sse-client]
last_updated: 2026-05-14
---

# chatWithWikiStream(query, messages, contextPages?, signal?): AsyncGenerator<WikiChatChunk>

POSTs to `/api/wiki-chat` with query, message history, and optional context pages, yielding SSE-streamed [[WikiChatChunk]] events.

## Signature
```typescript
export async function* chatWithWikiStream(
  query: string,
  messages: WikiChatMessage[],
  contextPages?: string[],
  signal?: AbortSignal
): AsyncGenerator<WikiChatChunk, void, unknown>
```

## Parameters
- `query: string` — User's question or prompt
- `messages: WikiChatMessage[]` — Conversation history (role + content)
- `contextPages?: string[]` — Optional list of wiki page paths to include as context
- `signal?: AbortSignal` — Cancellation signal

## Yields
- Chunks streamed from the server via [[readSseStream]]

## Errors
- Throws with server response body on non-OK status

## API Endpoint
- `POST /api/wiki-chat` with JSON body: `{ query, messages, context_pages: contextPages }`
- Content-Type: application/json