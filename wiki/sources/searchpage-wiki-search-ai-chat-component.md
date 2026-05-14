---
title: "SearchPage — Wiki Search & AI Chat Interface Component"
type: source
tags: [frontend, typescript, react, search, chat, sse, web-search]
date: 2026-05-14
source_file: SearchPage.tsx
---

## Summary
The `SearchPage` component (`SearchPage.tsx`) is the unified search and AI interaction hub for the [[LLMWikiViewer]] frontend. It provides three primary tabs: **Search** (hybrid/local/unified wiki search with semantic toggle and embedding reindex), **Chat** ([[SSEStreamProtocol]]-based wiki-grounded chat via [[chatWithWikiStream]]), and **Generate** (knowledge package generation). It also includes a **Web Search** tab for external URL results via [[searchWeb]]. Built with [[ReactRouter]] (search params for query/tab state), [[i18next]], [[FramerMotion]] for animations, and centralized state via Zustand stores ([[useNotificationStore]]).

## Key Claims
- **Three-tab architecture**: `search`, `chat`, `generate` tabs switchable via UI buttons or URL `?tab=` param, with state persistence across navigation.
- **Tiered search fallback**: `searchUnified()` (backend) → `hybridSearch()` (local), ensuring availability even when API server is down.
- **Semantic search toggle**: `localStorage`-persisted `wiki-semantic-search` flag toggles between FTS5 only and FTS5 + Ollama embedding hybrid search.
- **Embedding reindex**: `reindexEmbeddings()` callable from UI with status notification via [[useNotificationStore]].
- **Wiki-grounded chat streaming**: `chatWithWikiStream()` with [[AbortController]] cancellation, auto-attachment of top 5 search results as context, source citation display.
- **Web search tab**: `searchWeb()` stub endpoint with loading/empty/result states, graceful empty handling.
- **Debounced input**: 200ms debounce via [[UseDebounce]] to avoid excessive API calls during typing.
- **Apple-style UI**: `apple-card` styling, Framer Motion staggered animations, loading skeletons, empty state with icons.
- **URL state sync**: `useSearchParams` bidirectional sync for `q` (query) and `tab` params, enabling shareable search URLs.
- **Chat history context**: Accumulates `ChatEntry[]` with role/content/sources/timestamp, feeds full history to stream endpoint for conversational continuity.
- **Abort on tab switch**: Active chat stream is aborted when switching away from Chat tab to prevent orphan requests.

## Key Quotes
> "Tiered search: backend unified → local hybrid fallback" — SearchPage implements graceful degradation when backend is unavailable.
> "Three tabs: search, chat, generate" — Component architecture enabling wiki search, AI chat, and knowledge generation in one interface.

## Connections
- [[chatWithWikiStream]] — SSE streaming chat endpoint used in Chat tab
- [[searchWeb]] — external web search stub
- [[searchUnified]] — backend unified search with fallback
- [[HybridSearch]] — local FTS5 + optional semantic search
- [[getAllNodes]] — graph node accessor for local search
- [[reindexEmbeddings]] — Ollama embedding rebuild trigger
- [[useNotificationStore]] — Zustand notification store for user feedback
- [[GraphNode]] — graph node type for search result items
- [[UnifiedSearchResult]] — backend search result type
- [[ChatEntry]] — chat history entry type
- [[SSEStreamProtocol]] — streaming protocol used by chat
- [[AbortController]] — stream cancellation mechanism
- [[UseDebounce]] — input debounce hook
- [[FramerMotion]] — animation library for staggered entry
- [[i18next]] — internationalization
- [[ReactRouter]] — URL state and navigation
- [[LLMWikiViewer]] — parent application
- [[SearchResultsTab]] — renders search results in the Search tab
- [[ChatTab]] — renders the chat interface in the Chat tab
- [[GenerateTab]] — renders the knowledge generation panel

## Contradictions
- None identified.
