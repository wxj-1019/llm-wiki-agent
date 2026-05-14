---
title: "useChat — Agent Kit Chat State Management Hook for LLM Wiki Viewer"
type: source
tags: [frontend, typescript, react, hook, chat, agent-kit, knowledge-generation]
date: 2026-05-14
source_file: useChat.ts
---

## Summary
The `useChat` hook (`useChat.ts`) manages the full chat state lifecycle for the [[AgentKit]] chat interface in the [[LLMWikiViewer]] frontend. It handles streaming LLM conversations, [[KnowledgeGeneration]] (MCP/Skill generation from wiki knowledge), quick prompts for code review and tool suggestions, chat persistence via [[LocalStorage]] with debounced saves, and preview/editor integration. Uses [[StreamDeduplicator]] from `streamUtils` and [[agentKitLLMService]] for backend communication.

## Key Claims
- **Dual-mode chat**: Supports both free-form LLM chat (`chatWithLLMStream`) and knowledge-based generation (`generateFromKnowledge`) for MCP server and Skill creation. Knowledge gen mode is activated via `startKnowledgeGen(target)`, which sets a `knowledgeGenTarget` and routes subsequent `handleSendChat` calls to `generateFromKnowledge`.
- **Chat persistence**: Chat history (`ChatMessage[]`) is persisted to `agent-kit-chat-history` in localStorage via [[safeStorage]] (`safeGet/safeSet`). Persistence is debounced at 500ms via `persistTimerRef` to avoid thrashing on rapidly updating state.
- **Stream deduplication**: Uses [[StreamDeduplicator]] from `streamUtils` to process incoming LLM stream chunks, preventing duplicate or out-of-order content. `mergeStreamChunk` handles appending new content to the existing assistant message.
- **Abort support**: `chatAbortRef` holds an [[AbortController]] passed to the streaming API call. `handleStopChat` aborts it and resets loading state, allowing user to cancel in-flight generation.
- **Quick prompts**: `handleQuickPrompt(type)` runs predefined system prompts for: `'review-skill'` (review [[SKILL.md]]), `'review-mcp'` (review [[WikiMCPServer]] code at `mcp-server/wiki_mcp_server.py`), `'suggest-tools'` (suggest new MCP tools), `'custom'` (generic help). Uses [[readAgentKitFile]] to fetch the file contents for review.
- **Knowledge generation**: `startKnowledgeGen(target)` clears chat, shows a guide message, and sets `knowledgeGenTarget` to `'mcp'` or `'skill'`. After generation, if the resulting code is >50 chars, it sets `previewContent` and `previewPath`, then opens the editor (`setEditorOpen(true)`). Also shows knowledge sources via `setShowSources`.
- **Editor integration**: `handleSavePreview` writes the preview content to file via [[saveAgentKitFile]]. `handleOpenInEditor` opens the current preview file path using whichever IDE is configured.
- **Reset**: `resetChat` clears all state (messages, preview, editor, knowledge gen target, sources) and reopens the chat panel.

## Key Quotes
> "Knowledge gen mode routes subsequent handleSendChat calls to generateFromKnowledge" — dual-mode architecture
> "Chat history debounced at 500ms to avoid thrashing" — persistence strategy

## Connections
- [[StreamDeduplicator]] — from `lib/streamUtils`, used for processing stream chunks
- [[agentKitLLMService]] — provides `chatWithLLMStream`, `generateFromKnowledge`, `readAgentKitFile`, `saveAgentKitFile`
- [[safeStorage]] — from `lib/safeStorage`, provides `safeGet`, `safeSet`, `isArray`
- [[AgentKit]] — the overall Agent Kit system this hook supports
- [[KnowledgeGeneration]] — the MCP/Skill generation from wiki knowledge
- [[ChatService]] — underlying chat service infrastructure
- [[Header]] — likely consumer component that opens the chat
- [[ChatPage]] — page that uses this hook
- [[CommandPalette]] — may trigger `startKnowledgeGen` or quick prompts

## Contradictions
- No contradictions with existing wiki content.
