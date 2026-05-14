---
title: "loadSearchHistory — Search History Loader"
type: code_func
tags: [typescript, utility, local-storage]
sources: [chatsearchpanel-search-panel-component]
last_updated: 2026-05-14
---

## loadSearchHistory

```typescript
function loadSearchHistory(): SearchHistory
```

### Purpose
Loads per-mode search history from [[LocalStorage]] under key `'wiki-chat-search-history'`.

### Returns
`SearchHistory` object with `{ wiki: string[], web: string[] }`. Returns default empty structure on parse error or missing data.

### Related
- [[ChatSearchPanel]] — consumer
- [[SaveSearchHistory]] — companion writer