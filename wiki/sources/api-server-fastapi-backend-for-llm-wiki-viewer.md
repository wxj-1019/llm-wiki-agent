---
title: "API Server (api_server.py) — FastAPI Backend for LLM Wiki Viewer"
type: source
tags: [api, python, fastapi, backend, wiki]
date: 2026-05-14
source_file: tools/api_server.py
---

## Summary
The **API Server** (`api_server.py`) is a [[FastAPI]]-based backend that serves the [[LLMWikiViewer|wiki-viewer/]] React frontend and exposes REST/WebSocket endpoints for wiki content, search, graph operations, LLM chat, file uploads, webhooks, and tool execution. It provides a J.A.R.V.I.S.-themed AI butler persona for chat, supports SSE streaming for ingest progress, includes a page content cache with TTL, and has security features like path traversal protection, webhook token auth, and upload size limits.

## Key Claims
- Serves wiki pages via `/api/pages`, GraphQL-style `/api/graph` queries, and flat file listing at `/api/browse`.
- Provides LLM chat via `/api/chat` with J.A.R.V.I.S. persona, context injection, and optional web search integration via [[DuckDuckGo]].
- Supports file upload and ingestion via `/api/upload` with 20MB limit.
- Implements a page content cache (`_page_cache`) with 256-entry max and 300s TTL.
- Includes `/api/tools` endpoint to run whitelisted wiki tools (`lint.py`, `heal.py`, `refresh.py`, `build_graph.py`) as subprocesses.
- Webhook endpoint (`/api/webhook/ingest`) supports GitHub-style push events with optional token-based auth.
- WebSocket endpoint (`/api/ws/ingest-progress`) streams real-time ingest progress to connected clients.
- Serves the production-built React frontend from `wiki-viewer/dist/` as an SPA.
- Exposes `/api/search` for full-text search and `/api/health` for server health monitoring.
- Has structured logging via `logging` module and supports CORS for cross-origin requests.

## Key Quotes
> "You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), an AI butler and knowledge steward. You are polite, precise, and understated."

> "Lightweight API server for LLM Wiki Agent."

## Connections
- [[FastAPI]] (concept) — web framework used for the server
- [[LLMWikiViewer|wiki-viewer/]] (entity) — the React frontend served by this API
- [[GraphQueryEngine]] (concept) — GraphQL-style query engine for graph data
- [[IngestWorkflow]] (concept) — the ingestion pipeline triggered via upload/webhook
- [[JARVIS]] (concept) — the AI butler persona for chat
- [[DuckDuckGo]] (entity) — web search integration in chat
- [[WebSocket]] (concept) — real-time communication protocol for ingest progress
- [[CORS]] (concept) — cross-origin resource sharing middleware
- [[EventBus]] (concept) — SSE streaming infrastructure
- [[StateMonitor]] (concept) — background task for monitoring state changes

## Contradictions
None.
