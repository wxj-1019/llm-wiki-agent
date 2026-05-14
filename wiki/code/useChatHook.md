---
title: "useChat()"
type: code_func
tags: [react, hook, chat, agent-kit]
source_file: wiki-viewer/src/hooks/useChat.ts
sources: [usechat-agent-kit-chat-state-management-hook]
last_updated: 2026-05-14
signature: "useChat(addToast: (message: string, type: 'success' | 'error') => void, loadStatus: () => Promise<void>, loadFiles: () => Promise<void>): UseChatReturn"
---

## Purpose
Manages the full chat state lifecycle for the [[AgentKit]] chat interface in the [[LLMWikiViewer]] frontend. Handles dual-mode chat (free-form LLM + knowledge-based generation) with streaming, persistence, abort, quick prompts, and editor integration.

## Parameters
- `addToast` — callback to display toast notifications (success/error)
- `loadStatus` — callback to reload agent kit status
- `loadFiles` — callback to reload file list

## Returns
An object containing:
- `chatOpen`, `setChatOpen` — boolean state and setter for chat panel visibility
- `chatMessages`, `setChatMessages` — array of [[ChatMessage]] objects
- `chatInput`, `setChatInput` — current input text
- `chatLoading` — boolean indicating if a response is being generated
- `previewContent`, `setPreviewContent` — generated file preview text
- `previewPath`, `setPreviewPath` — generated file path
- `editorOpen`, `setEditorOpen` — boolean for editor visibility
- `knowledgeGenTarget`, `setKnowledgeGenTarget` — `'mcp' | 'skill' | null`
- `knowledgeSources`, `showSources`, `setShowSources` — generation source tracking
- `handleSendChat(content)` — sends a message or initiates knowledge generation
- `handleStopChat()` — aborts current generation via [[AbortController]]
- `handleQuickPrompt(type)` — runs predefined review/suggestion prompts
- `handleSavePreview()` — writes preview to file via [[saveAgentKitFile]]
- `handleOpenInEditor()` — opens preview file in IDE
- `startKnowledgeGen(target)` — initiates MCP or Skill generation mode
- `resetChat()` — clears all state and reopens chat

## Implementation Notes
- Uses `chatMessagesRef` to avoid stale closures in streaming callbacks
- Uses `chatLoadingRef` as a guard to prevent duplicate parallel sends
- Persists chat history debounced at 500ms
- Uses [[StreamDeduplicator]] to handle streaming chunks