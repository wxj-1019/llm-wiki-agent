---
title: "ChatConversation — Chat Message List Component for LLM Wiki Viewer"
type: source
tags: [frontend, typescript, react, chat, virtual-scroll, conversation]
date: 2026-05-14
source_file: ChatConversation.tsx
---

## Summary
The `ChatConversation` component (`ChatConversation.tsx`) is the scrollable conversation message list for the [[ChatPage]] in the [[LLMWikiViewer]] frontend. It renders a list of `ChatEntry` items with virtual scrolling (windowed rendering), date dividers between days, a scroll-to-bottom button, loading/empty states, and integrates with [[ChatMessage]] for each entry. It uses [[i18next]] for date/time localization (Today/Yesterday/date labels).

## Key Claims
- **Virtual scrolling via render window**: Only the last `renderWindow` entries are rendered in the DOM. When entries exceed the window, a count banner shows how many earlier messages are collapsed (`{virtualOffset} earlier messages`). This keeps DOM size bounded for long conversations.
- **Date dividers**: Computed by `formatDateDivider()` which shows "Today", "Yesterday", or a locale-formatted date string when the date changes between consecutive entries (using the `timestamp` field). Powered by [[i18next]] for translation (`date.today`, `date.yesterday`).
- **Scroll-to-bottom button**: A floating button appears (`showScrollToBottom` prop) that calls `onScrollToBottom` to auto-scroll the container. Uses an [[ArrowDown]] icon from [[Lucide|Lucide React]].
- **Loading/empty states**: Shows a pulsing blue dot with "Thinking..." text when `loading` is true and `streaming` is false. When entries are empty and not loading, displays a [[MessageCircleIcon]] SVG and "Ask anything about your wiki" placeholder.
- **All interactions via callbacks**: Copy (`onCopy`), reply (`onReply`), bookmark toggle (`onToggleBookmark`), continue generation (`onContinue`), source click (`onSourceClick`), delete (`onDelete`), edit (`onEdit`), regenerate (`onRegenerate`). These props are forwarded to each [[ChatMessage]] child component.
- **`formatTime` utility**: Formats a UNIX timestamp to `HH:MM` (24h) locale time string. Used for per-message timestamps.
- **No local state**: All state is passed via props, making it a pure presentational component.

## Key Concepts
- [[VirtualScrolling]] — Windowed rendering to limit DOM nodes for long conversation histories
- [[DateDivider]] — Separator between messages from different calendar days, with i18n-aware labels
- [[ScrollToBottom]] — Floating action button pattern for chat/conversation UIs

## Connections
- [[ChatPage]] — parent page that owns the state and passes props to ChatConversation
- [[ChatMessage]] — child component rendered for each entry
- [[i18next]] — used for translating date labels and empty state text
- [[Lucide]] — provides the ArrowDown icon for scroll-to-bottom button
- [[WikiChatSource]] — type imported from chatService for assistant message sources
- [[SafeJson]] — used in ChatPage for session persistence via [[LocalStorage]]
- [[SSEStreamProtocol]] — protocol underlying the streaming chat feature
- [[MainFundSelection]] — the chat system is part of the broader LLM Wiki Viewer infrastructure

## Contradictions
- None identified.