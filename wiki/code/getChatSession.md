---
title: "getChatSession"
type: code_func
tags: [typescript, chat, session]
sources: [chat-service-sse-client]
last_updated: 2026-05-14
---

# getChatSession(sessionId: string): Promise<{ id: string; title: string; messages: WikiChatMessage[] }>

Retrieves a single chat session with all its messages from the backend.

## Signature
```typescript
export async function getChatSession(sessionId: string): Promise<{ id: string; title: string; messages: WikiChatMessage[] }>
```

## Parameters
- `sessionId: string` — Session UUID

## Returns
- Session object with id, title, and messages array

## API Endpoint
- `GET /api/chat/sessions/:sessionId`