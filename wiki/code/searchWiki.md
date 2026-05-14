---
title: "searchWiki"
type: code_func
tags: [typescript, search, wiki]
sources: [chat-service-sse-client]
last_updated: 2026-05-14
---

# searchWiki(query: string, limit = 20): Promise<{ results: WikiSearchResult[] }>

Performs a full-text search against the wiki index via the backend API.

## Signature
```typescript
export async function searchWiki(
  query: string,
  limit = 20
): Promise<{ results: WikiSearchResult[] }>
```

## Parameters
- `query: string` — Search query string
- `limit: number` — Max results (default 20)

## Returns
- `{ results: WikiSearchResult[] }` — Array of search results with title, excerpt, and path

## Errors
- Throws with server response body on non-OK status
- Throws on empty or non-JSON responses via [[SafeJson]]

## API Endpoint
- `GET /api/search?q=...&limit=...`