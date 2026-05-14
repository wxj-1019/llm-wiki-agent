---
title: "safeJson"
type: code_func
tags: [typescript, utility]
sources: [chat-service-sse-client]
last_updated: 2026-05-14
---

# safeJson<T>(res: Response): Promise<T>

Generic safe JSON response parser that handles empty responses and malformed JSON. Used across the chat service and data layer.

## Signature
```typescript
async function safeJson<T>(res: Response): Promise<T>
```

## Parameters
- `res: Response` — Fetch API Response object

## Returns
- `Promise<T>` — Parsed JSON typed as T

## Errors
- Throws if response body is empty (status included for debugging)
- Throws if response body is not valid JSON (first 200 chars included)

## Used by
- [[searchWiki]]
- [[createChatSession]]
- [[listChatSessions]]
- [[getChatSession]]
- [[appendChatMessage]]