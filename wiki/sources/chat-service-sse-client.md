---
title: "Chat Service — Wiki Chat & SSE Stream Client"
type: source
tags: [code, frontend, typescript, chat, sse, api]
date: 2026-05-14
source_file: chatService.ts
---

## Summary

The `chatService.ts` module is a TypeScript service layer for the LLM Wiki Viewer frontend. It provides SSE (Server-Sent Events) streaming clients for wiki chat (`chatWithWikiStream`), direct LLM chat (`chatWithLLMStream`), a search interface (`searchWiki`, `searchWeb`), and chat session persistence (create, list, migrate from localStorage to PostgreSQL). All streaming endpoints follow a unified SSE event parsing protocol with automatic timeout handling at 60 seconds.

## Key Claims

- **Unified SSE parser**: `readSseStream()` is a shared async generator that reads a `ReadableStream`, buffers partial events, and parses `data:` lines into typed `WikiChatChunk` objects. Supports cancel via `AbortSignal` and 60s stream timeout.
- **Event types**: `chunk` (incremental text), `sources` (citation sources), `status` (intermediate status updates), `error` (fatal errors), `done` (stream termination). `[DONE]` sentinel signals normal termination.
- **Two chat endpoints**: `chatWithWikiStream()` POSTs to `/api/wiki-chat` with query, message history, and optional context pages; `chatWithLLMStream()` POSTs to `/api/agent-kit/llm-chat-stream` with messages and optional system prompt.
- **Safe JSON parsing**: `safeJson<T>()` validates non-empty, valid JSON responses; throws descriptive errors with status code and snippet for debugging.
- **Wiki search**: `searchWiki()` queries `/api/search?q=...&limit=...` and maps results to `WikiSearchResult[]`. `searchWeb()` is a stub returning empty results (backend not yet implemented).
- **Chat session persistence**: Functions `createChatSession()`, `listChatSessions()`, `getChatSession()`, `appendChatMessage()` manage sessions via `/api/chat/sessions` REST endpoints.
- **LocalStorage → PG migration**: `migrateLocalStorageToPG()` reads `wiki-chat-sessions` from localStorage, migrates each session's messages to the backend, and clears localStorage on success. Reports migrated count and per-session errors.

## Key Functions

- [[SafeJson]] — generic safe JSON response parser
- [[parseSseEvent]] — parses a single SSE event text into a WikiChatChunk
- [[readSseStream]] — async generator yielding parsed SSE chunks from a Response body
- [[chatWithWikiStream]] — streams wiki chat responses with context
- [[chatWithLLMStream]] — streams direct LLM chat responses
- [[searchWiki]] — full-text search against the wiki index
- [[searchWeb]] — web search (stub, not yet implemented on backend)
- [[createChatSession]], [[listChatSessions]], [[getChatSession]] — session CRUD
- [[appendChatMessage]] — appends messages to a chat session
- [[migrateLocalStorageToPG]] — migrates legacy localStorage sessions to PostgreSQL

## Connections

- [[APIServer]] — backend serving `/api/wiki-chat` and `/api/agent-kit/llm-chat-stream` endpoints
- [[SSEStreamProtocol]] — event-driven streaming protocol used
- [[DataService]] — frontend data layer using these chat functions
- [[WikiStore]] — Zustand store consuming chat state

## Key Quotes

> "Backend returned empty response (status ${res.status}). Is the API server running?"
> "Response timed out. The server may be overloaded."
> "Web search is not implemented on backend yet"