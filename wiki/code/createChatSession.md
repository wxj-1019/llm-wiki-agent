---
title: "createChatSession"
type: code_func
tags: [typescript, chat, session]
sources: [chat-service-sse-client]
last_updated: 2026-05-14
---

# createChatSession(title: string): Promise<{ id: string }>

Creates a new chat session on the backend.

## Signature
```typescript
export async function createChatSession(title: string): Promise<{ id: string }>
```

## Parameters
- `title: string` — Session display title

## Returns
- `{ id: string }` — Newly created session ID

## API Endpoint
- `POST /api/chat/sessions`

## Used by
- [[migrateLocalStorageToPG]]