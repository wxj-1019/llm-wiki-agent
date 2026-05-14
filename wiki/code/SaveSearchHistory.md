---
title: "saveSearchHistory — Search History Persister"
type: code_func
tags: [typescript, utility, local-storage]
sources: [chatsearchpanel-search-panel-component]
last_updated: 2026-05-14
---

## saveSearchHistory

```typescript
function saveSearchHistory(h: SearchHistory): void
```

### Purpose
Persists per-mode search history to [[LocalStorage]] under key `'wiki-chat-search-history'`.

### Parameters
| Param | Type | Description |
|---|---|---|
| `h` | `SearchHistory` | History object with wiki and web query arrays |

### Related
- [[ChatSearchPanel]] — consumer
- [[LoadSearchHistory]] — companion loader