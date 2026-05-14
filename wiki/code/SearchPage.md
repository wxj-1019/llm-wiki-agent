---
title: "SearchPage — Component"
type: code_module
tags: [frontend, react, typescript]
sources: [searchpage-wiki-search-ai-chat-component]
last_updated: 2026-05-14
---

# SearchPage — Component

**File:** `wiki-viewer/src/pages/SearchPage.tsx`

## Purpose
Unified search and AI interaction hub for the [[LLMWikiViewer]]. Provides three primary interaction modes (Search, Chat, Generate) plus Web Search, all with URL-based state persistence.

## Signature
```tsx
export function SearchPage(): JSX.Element
```

## State
- `query` / `debouncedQuery` — search input with 200ms debounce ([[UseDebounce]])
- `results` — [[FuseResult]]<[[GraphNode]]>[] — local search results (fallback)
- `unifiedResults` — [[UnifiedSearchResult]][] — backend search results
- `searching` — boolean
- `semantic` — localStorage-persisted toggle for [[HybridSearch]] mode
- `reindexing` — boolean for [[reindexEmbeddings]] progress
- `activeTab` — `Tab` union: `'search' | 'chat' | 'generate' | 'web'`
- `chatEntries` — [[ChatEntry]][] — chat history for current session
- `chatStreaming` / `chatLoading` — streaming state
- `abortRef` — [[AbortController]] reference for chat stream cancellation

## Behavior
1. Reads `?q=` and `?tab=` from URL on mount via [[useSearchParams]]
2. On debounced query change (≥200ms idle):
   - Attempts `searchUnified()` backend call
   - Falls back to `hybridSearch()` locally if backend unavailable
3. Chat tab: accumulates chat history, sends full context (last 5 search results + message history) to `chatWithWikiStream()`, renders streaming response with source citations
4. Aborts active chat stream when switching away from Chat tab
5. Web Search tab: calls `searchWeb()` stub endpoint

## Connections
- Uses: [[searchUnified]], [[HybridSearch]], [[chatWithWikiStream]], [[searchWeb]], [[reindexEmbeddings]]
- Integrates with: [[useNotificationStore]], [[UseDocumentTitle]], [[UseDebounce]]
- Renders: [[SearchResultsTab]], [[ChatTab]], [[GenerateTab]]
- Uses [[FramerMotion]] for animation