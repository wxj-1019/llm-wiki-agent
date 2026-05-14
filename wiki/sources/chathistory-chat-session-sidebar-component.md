---
title: "ChatHistory — Chat Session Sidebar Component for LLM Wiki Viewer"
type: source
tags: [frontend, typescript, react, chat, history, sidebar]
date: 2026-05-14
source_file: ChatHistory.tsx
---

## Summary
The `ChatHistory` component (`ChatHistory.tsx`) is the collapsible sidebar for browsing and managing chat sessions in the [[ChatPage]] of the [[LLMWikiViewer]] frontend. It provides session grouping by date (today/yesterday/this week/earlier), search/filter by title, new chat creation, rename, delete, a collapsed icon-only mode, and an auto-focusing search input. Uses [[i18next]], [[FramerMotion]], and [[Lucide|Lucide React]].

## Key Claims
- **Date-based grouping**: The `groupByDate()` helper (lines 20-36) classifies sessions into `today`, `yesterday`, `thisWeek`, `earlier` by comparing the session's `updatedAt` date against relative date boundaries. Uses [[i18next]] for localized date labels (`t('chat.history.today')`, etc.).
- **Collapsible sidebar**: Controlled by `collapsed` prop. When collapsed, renders a slim `40px` icon-only button with a [[ChatHistory|MessageSquareIcon]] SVG, animation via [[FramerMotion]] `motion.button`. Uncollapses to a `260px` wide panel.
- **Search/filter**: Local filter via `searchQuery` state and `useMemo` (lines 44-47), filtering by matching `title` (lowercased). Input auto-focuses on uncollapse via `useEffect` (lines 49-51).
- **Session management**: New chat (`onNew`), rename (`onRename`, forwarded to [[ChatHistoryItem]]), delete (`onDelete`), switch (`onSwitch`). Active session highlighted via `isActive={session.id === activeId}`.
- **Grouped list rendering**: Each group section has a `10px` uppercase label (e.g. "Today", "Yesterday"), followed by [[ChatHistoryItem]] components. Empty and no-results states with [[i18next]] messages.
- **Header with controls**: Top row has "History" title, new chat button with [[Plus]] icon, and collapse button with [[ChevronLeft]] icon.
- **Inline SVG icon**: `MessageSquareIcon()` is a self-contained SVG component rendering a standard speech bubble icon.

## Key Quotes
> No direct quotes; code-documented component.

## Connections
- [[ChatPage]] — the parent page that uses `ChatHistory` as a sidebar
- [[ChatHistoryItem]] — renders individual session entries
- [[LLMWikiViewer]] — the overall app
- [[i18next]] — for date/time and text localization
- [[FramerMotion]] — for collapse/expand animation
- [[Lucide]] — for icon set

## Contradictions
- None identified.
