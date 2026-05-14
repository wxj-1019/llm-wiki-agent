---
title: "SearchHistory"
type: entity
tags: [typescript, interface]
sources: [chatsearchpanel-search-panel-component]
last_updated: 2026-05-14
---

**SearchHistory** is a TypeScript interface in [[ChatSearchPanel]] that holds per-mode search query arrays: `{ wiki: string[]; web: string[] }`. Persisted in [[LocalStorage]] under `'wiki-chat-search-history'` with a limit of 10 entries per mode.