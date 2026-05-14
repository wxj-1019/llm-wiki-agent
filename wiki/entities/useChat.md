---
title: "useChat"
type: entity
tags: [react, hook, chat, agent-kit]
sources: [usechat-agent-kit-chat-state-management-hook]
last_updated: 2026-05-14
---

The `useChat` hook (`useChat.ts`) manages chat state for the [[LLMWikiViewer]] Agent Kit interface. It supports two modes: free-form LLM chat via `chatWithLLMStream` and knowledge-based generation via `generateFromKnowledge` for creating MCP servers and Skills. Implements debounced localStorage persistence (500ms), stream deduplication via [[StreamDeduplicator]], abort support via [[AbortController]], quick prompts for code review and tool suggestions, and editor integration for saving generated files.

Returns: `chatOpen`, `chatMessages`, `chatInput`, `chatLoading`, `previewContent`, `previewPath`, `editorOpen`, `knowledgeGenTarget`, `knowledgeSources`, `showSources`, `handleSendChat`, `handleStopChat`, `handleQuickPrompt`, `handleSavePreview`, `handleOpenInEditor`, `startKnowledgeGen`, `resetChat`

Key implementation details:
- Persists to `agent-kit-chat-history` key in localStorage
- Uses [[safeStorage]] `safeGet`/`safeSet`/`isArray` for type-safe storage access
- `handleQuickPrompt` fetches file content via [[readAgentKitFile]] for review prompts
- `handleSavePreview` calls [[saveAgentKitFile]] to write generated content
- Chat history for API calls is read from `chatMessagesRef.current` to avoid stale closure issues
- `chatLoadingRef` is used as a guard to prevent duplicate sends