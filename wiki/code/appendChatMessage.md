---
title: "appendChatMessage"
type: code_func
tags: [typescript, chat, session]
sources: [chat-service-sse-client]
last_updated: 2026-05-14
---

# appendChatMessage(sessionId, message): Promise<any>

Appends a message to an existing chat session on the backend.

## Signature
```typescript
export async function appendChatMessage(
  sessionId: string,
  message: { role: string; content: string; sources?: WikiChatSource[] }
): Promise<any>
```

## Parameters
- `sessionId: string` — Session UUID
- `message` — Object with role, content, and optional sources array

## Returns
- Backend response (parsed via [[SafeJson]])

## Errors
- Throws on non-ok status

## API Endpoint
- `POST /api/chat/sessions/:sessionId/messages`