---
title: "WikiChatSource"
type: entity
tags: [frontend, chat, citations]
sources: [chat-service-sse-client]
last_updated: 2026-05-14
---

# WikiChatSource

`WikiChatSource` is a TypeScript interface representing a cited source in the wiki chat response:

```typescript
interface WikiChatSource {
  path: string;    // URL or file path to the source
  preview: string; // snippet or summary
}
```

Returned inside `WikiChatChunk` events of type `'sources'`.