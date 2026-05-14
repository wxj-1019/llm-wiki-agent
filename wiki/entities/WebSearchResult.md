---
title: "WebSearchResult"
type: entity
tags: [frontend, search, web]
sources: [chat-service-sse-client]
last_updated: 2026-05-14
---

# WebSearchResult

`WebSearchResult` is a TypeScript interface representing a web search result:

```typescript
interface WebSearchResult {
  title: string;
  body: string;
  href: string;
}
```

Currently unused — [[searchWeb]] returns empty results as the backend web search endpoint is not yet implemented.