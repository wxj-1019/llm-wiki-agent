---
title: "listChatSessions"
type: code_func
tags: [typescript, chat, session]
sources: [chat-service-sse-client]
last_updated: 2026-05-14
---

# listChatSessions(): Promise<{ sessions: { id: string; title: string; created_at: string }[] }>

Lists all chat sessions from the backend.

## Signature
```typescript
export async function listChatSessions(): Promise<{ sessions: { id: string; title: string; created_at: string }[] }>
```

## Returns
- List of sessions with id, title, and created_at timestamp

## API Endpoint
- `GET /api/chat/sessions`