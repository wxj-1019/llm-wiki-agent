---
title: "ChatPage — Chat Interface Component for LLM Wiki Viewer"
type: source
tags: [frontend, typescript, react, chat, sse, session]
date: 2026-05-14
source_file: ChatPage.tsx
---

## Summary
The `ChatPage` component (`ChatPage.tsx`) is the central chat interface for the [[LLMWikiViewer|LLM Wiki Viewer]] frontend, providing a full-featured conversational AI experience. It supports wiki-aware chat ([[chatWithWikiStream]]), direct LLM chat ([[chatWithLLMStream]]), session management with persistence ([[LocalStorage]]), search history, find-in-page, [[@mention]] page references, slash commands, summarization, and a generate-from-knowledge panel ([[generateFromKnowledge]]) for creating [[Skill]] and [[MCP]] packages. Built with [[ReactRouter]] (search params, navigation) and [[i18next]] for internationalization.

## Key Claims
- **Session management**: Creates, loads, saves, and deletes chat sessions via `safeGet`/`safeSet` ([[SafeJson]]) in [[LocalStorage]]. Sessions include title, messages, timestamps, and a `isDefaultTitle` flag for auto-generated titles.
- **Streaming chat**: Two modes — `chatWithWikiStream` (wiki-grounded) and `chatWithLLMStream` (direct). Both use [[SSEStreamProtocol]] with [[AbortController]] for cancellation.
- **@mention system**: Type `@` followed by a query triggers [[WikiSearchResult]] lookup with debounce and dropdown selection. Selected pages are formatted as `[[PageName]]` in the input area.
- **Slash command system**: Type `/` to access commands like `/summarize`, `/tone`, `/simplify` for post-generation actions.
- **Generate panel**: A side panel that calls [[generateFromKnowledge]] to produce [[Skill]] (Jinja2 templates) or [[MCP]] server code from wiki knowledge, with preview/edit/download functionality.
- **Find in page**: A find panel (`Ctrl+K`) for searching within the current chat conversation, with highlight and navigation.
- **Summarization**: Supports summarization styles: `brief`, `detailed`, `bullet`, `action`.
- **Layout**: Three-column layout (history, messages, right panel) with collapsible sidebar and right panel.
- **Scroll-to-bottom**: Auto-scroll with smart detection; shows "scroll to bottom" button when not at bottom.
- **Search history**: Tracks recent wiki/web searches (max 10 each) in localStorage.

## Key Quotes
> "Enter 发送 · Shift+Enter 换行 · @ 引用页面 · Ctrl+K 搜索" — Bottom hint showing keyboard shortcuts for the chat interface.

## Connections
- [[chatWithWikiStream]] — SSE streaming for wiki-grounded chat
- [[chatWithLLMStream]] — SSE streaming for direct LLM chat
- [[generateFromKnowledge]] — Generate Skill/MCP packages from wiki knowledge
- [[WikiSearchResult]] — Search result type from wiki search
- [[WikiChatSource]] — Citation source type for wiki chat
- [[StreamDeduplicator]] — Deduplication utility for stream chunks
- [[MarkdownRenderer]] — Renders markdown content with [[Shiki]] syntax highlighting
- [[ChatHistory]] — Left sidebar component for session list
- [[ChatConversation]] — Main conversation view component
- [[ChatRightPanel]] — Right panel for sources/document preview
- [[SafeJson]] — Safe JSON parsing/storage utilities
- [[RootLayout]] — Parent layout component
- [[LazyLoading]] — Lazy loading pattern for routes (via `React.lazy`)

## Contradictions
- None identified.
