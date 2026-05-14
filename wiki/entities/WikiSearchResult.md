---
title: "WikiSearchResult"
type: entity
tags: [frontend, search]
sources: [chat-service-sse-client]
last_updated: 2026-05-14
---

# WikiSearchResult

`WikiSearchResult` is a TypeScript interface representing a search result from the full-text wiki search:

```typescript
interface WikiSearchResult {
  title: string;
  excerpt: string;
  path: string;
}
```

Produced by [[searchWiki]] and consumed by [[WikiStore]] for rendering search results.