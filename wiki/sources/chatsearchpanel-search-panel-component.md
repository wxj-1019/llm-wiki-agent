---
title: "ChatSearchPanel — Search Panel Component for LLM Wiki Viewer"
type: source
tags: [frontend, typescript, react, search, web-search, chat]
date: 2026-05-14
source_file: ChatSearchPanel.tsx
---

## Summary
The `ChatSearchPanel` component (`ChatSearchPanel.tsx`) is a split-mode search panel for the [[ChatPage]] in the [[LLMWikiViewer]] frontend. It supports Wiki (full-text) and Web search modes with debounced query input, results display with quote-to-chat functionality, and local search history persisted in [[LocalStorage]]. Uses [[i18next]] for all labels.

## Key Claims
- **Dual search mode**: Wiki mode (`[[BookOpen]]` icon) searches internal wiki via `searchWiki()`, Web mode (`[[Globe]]` icon) searches external content via `searchWeb()`. Mode toggle buttons styled with blue active state.
- **Debounced search**: 400ms debounce via `setTimeout` in a `useEffect`, with `AbortController` (`abortRef`) for cancellation. Searches only trigger when `query` trim is non-empty.
- **Search history**: Per-mode history (wiki/web) stored in [[LocalStorage]] under `'wiki-chat-search-history'` with max 10 entries per mode. Displays recent queries when input is empty. History loaded via `loadSearchHistory()` and saved via `saveSearchHistory()`.
- **Quote-to-chat**: Each search result has a "Quote" button (`[[ArrowRight]]` icon) that calls `onQuote(excerpt)` prop, allowing users to insert result text into chat input. Button appears on hover via group-hover opacity transition.
- **Loading/empty states**: [[Loader2]] spinning icon during search, "No results found" message via [[i18next]] `t('chat.searchNoResults')` when query has no results, and search history shown when query is empty.
- **Web search results**: Display `title` and `body` fields from [[WebSearchResult]]; wiki results display `title` (or `path` as fallback) and `excerpt` from [[WikiSearchResult]].
- **Focus management**: `inputRef` auto-focuses on mount, search bar always in focus for quick typing.

## Connections
- [[ChatPage]] — integrated as search sidebar panel
- [[SearchService]] (from `@/services/chatService`) — provides `searchWeb()` and `searchWiki()` APIs
- [[WikiSearchResult]] — result type for wiki searches
- [[WebSearchResult]] — result type for web searches
- [[LocalStorage]] — persistence for search history
- [[i18next]] — internationalization for all UI labels

## Key Quotes
> "Quote to Chat" — hover action on each search result

## Key Interfaces
- `ChatSearchPanelProps`: `{ onQuote: (text: string) => void }`
- `SearchHistory`: `{ wiki: string[]; web: string[] }`