---
title: "ChatPage"
type: code_class
tags: [react, component, chat]
sources: [chatpage-chat-interface-component]
---

## ChatPage Component

The main chat interface page exported from `ChatPage.tsx`.

### Purpose
Provides a full conversational AI UI for the [[LLMWikiViewer]] with wiki-aware and direct LLM chat modes, session management, @mention page references, slash commands, summarization, and generate-from-knowledge functionality.

### State
- **Sessions**: `ChatSession[]` — list of chat sessions stored in [[LocalStorage]]
- **Active session**: `string` — ID of the currently active session
- **Layout**: `leftCollapsed`, `rightCollapsed`, `rightTab` — 3-column layout control
- **Chat**: `input`, `loading`, `streaming`, `abortRef` — message input and streaming state
- **Mention**: `showMention`, `mentionQuery`, `mentionResults` — @mention autocomplete
- **Slash commands**: `showSlashMenu`, `slashQuery` — /command autocomplete
- **Generate panel**: `showGeneratePanel`, `generateTarget`, `generateResult` — knowledge generation
- **Find**: `showFindPanel`, `findQuery`, `findIndex` — in-page text search
- **Summarize**: `summarizeStyle` — output style for summarization (brief/detailed/bullet/action)

### Dependencies
- [[ReactRouter]] — URL params (`sessionId`), search params
- [[i18next]] — Internationalization via `useTranslation()`
- [[chatWithWikiStream]], [[chatWithLLMStream]], [[generateFromKnowledge]] — API service functions
- [[SafeJson]] — Type-safe localStorage read/write (`safeGet`/`safeSet`)
- [[StreamDeduplicator]], `mergeStreamChunk` — Stream utilities
- [[extractWikiLinks]] — Wikilink extraction from response
- [[useNotificationStore]] — Toast notifications
- [[UseDocumentTitle]] — Dynamic page title

### Key Features
- Wiki-aware streaming chat with source citations
- Session persistence with auto-save on each message
- @mention page lookup with debounced search
- /slash commands for post-generation actions (summarize, tone, simplify)
- Generate panel to produce [[Skill]]/[[MCP]] packages from wiki
- Find-in-page with highlight and navigation
- Scroll-to-bottom with smart detection
- Summarization with style selection
- Message bookmarking and copy

Related: [[LLMWikiViewer]], [[ChatHistory]], [[ChatConversation]], [[ChatRightPanel]]