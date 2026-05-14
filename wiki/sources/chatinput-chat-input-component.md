---
title: "ChatInput — Chat Input Component for LLM Wiki Viewer"
type: source
tags: [frontend, typescript, react, chat, input, menu]
date: 2026-05-14
source_file: ChatInput.tsx
---

## Summary
The `ChatInput` component (`ChatInput.tsx`) is the bottom toolbar and text input area for the [[ChatPage]] in the [[LLMWikiViewer]] frontend. It provides a multi-function toolbar with search, summarization style selection (brief/detailed/bullet/action), generate [[Skill]]/[[MCP]] buttons, a more-menu (web search, wiki search, refine, edit code), an auto-resizing textarea with keyboard shortcut (Enter to send, Shift+Enter for newline), and a send/stop button that switches icon based on streaming state.

## Key Claims
- **Toolbar row**: Contains search button (`[[Search]]`), summarization style dropdown (`[[FileText]]`), generate skill (`[[Zap]]`) and MCP (`[[Plug]]`) buttons, and a more-menu (`[[MoreHorizontal]]`) with web search, wiki search, refine, and edit code options. All icons from [[Lucide]] React.
- **Summarize menu**: A dropdown with four styles: `brief`, `detailed`, `bullet`, `action`. Each style calls `onSummarize(key)`. Menu positioned above the toolbar, auto-closes on outside click.
- **More menu**: Additional actions including `web search`, `wiki search`, `refine`, and `edit code`. Uses [[i18next]] translations for labels. Auto-closes on outside click.
- **Auto-resizing textarea**: The `<textarea>` grows vertically with content up to 160px max height, using `useEffect` to reset and recalculate `scrollHeight`. Controlled by `value` and `textareaRef`.
- **Send/Stop button**: When `streaming` is true, shows a red square (`[[Square]]`) with `onStop` callback. Otherwise shows a blue arrow-up (`[[ArrowUp]]`) with `onSend` callback. Disabled when offline or (not streaming and input empty).
- **Keyboard shortcut**: Enter sends message (if not loading and input non-empty); Shift+Enter inserts newline. No special handling for mobile.
- **Click outside handler**: Both menus close when clicking outside their respective `ref` containers, using `mousedown` event listener with cleanup.
- **Offline state**: When `online` is false, the textarea is disabled and placeholder shows "Offline mode". Send button is disabled.
- **i18n integration**: All labels use `t()` calls with translation keys: `chat.search`, `chat.summarize`, `chat.summarizeBrief`, `chat.summarizeDetailed`, `chat.summarizeBullet`, `chat.summarizeAction`, `chat.generateSkill`, `chat.generateMCP`, `chat.searchWeb`, `chat.searchWiki`, `chat.refine`, `chat.editCode`, `chat.placeholder`, `chat.offline`.

## Key Quotes
> "Enter to send, Shift+Enter for newline" — keyboard behavior documented in `handleKeyDown`

## Connections
- [[ChatPage]] — this component is the input footer for the chat page
- [[SSEStreamProtocol]] — the streaming protocol used by the chat backend
- [[Skill]] — generated via toolbar button `onGenerate('skill')`
- [[MCP]] — generated via toolbar button `onGenerate('mcp')`
- [[Lucide]] — icon set used (Square, ArrowUp, Search, FileText, Zap, Plug, ChevronDown, MoreHorizontal, Globe, BookOpen, Pencil, Wand2)
- [[i18next]] — all labels internationalized
- [[SafeJson]] — related: session data serialization pattern

## Contradictions
- None identified.