---
title: "chatWithLLMStream"
type: code_func
tags: [typescript, llm, chat, sse]
sources: [chat-service-sse-client]
last_updated: 2026-05-14
---

# chatWithLLMStream(messages, systemPrompt?, signal?): AsyncGenerator<WikiChatChunk>

POSTs to `/api/agent-kit/llm-chat-stream` for direct LLM interaction without wiki context injection, yielding SSE-streamed [[WikiChatChunk]] events.

## Signature
```typescript
export async function* chatWithLLMStream(
  messages: WikiChatMessage[],
  systemPrompt?: string,
  signal?: AbortSignal
): AsyncGenerator<WikiChatChunk, void, unknown>
```

## Parameters
- `messages: WikiChatMessage[]` — Chat message history
- `systemPrompt?: string` — Optional system prompt to override defaults
- `signal?: AbortSignal` — Cancellation signal

## Yields
- Chunks streamed from the server via [[readSseStream]]

## Errors
- Throws with server response body on non-OK status

## API Endpoint
- `POST /api/agent-kit/llm-chat-stream` with JSON body: `{ messages, system_prompt: systemPrompt }`