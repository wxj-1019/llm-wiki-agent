---
title: "APIServer"
type: code_module
tags: [api, fastapi, python]
sources: [api-server-fastapi-backend-for-llm-wiki-viewer]
last_updated: 2026-05-14
---

# APIServer

**File:** `tools/api_server.py`

FastAPI application serving the LLM Wiki Viewer frontend and REST/WebSocket API.

## Key Endpoints

### Content
- `GET /api/pages` — list all wiki pages
- `GET /api/page/{name}` — get a single page by name
- `GET /api/browse` — flat file listing of wiki directory
- `GET /api/search?q=` — full-text search via SQLite FTS5
- `POST /api/graph` — GraphQL-style graph query

### Chat & LLM
- `POST /api/chat` — J.A.R.V.I.S. persona chat with context injection
- `POST /api/chat/stream` — streaming SSE chat

### Ingestion
- `POST /api/upload` — file upload and ingest (20MB limit)
- `POST /api/webhook/ingest` — GitHub-style webhook trigger (optional token auth)
- `WebSocket /api/ws/ingest-progress` — real-time ingest progress stream

### Tools & Management
- `POST /api/tools` — run whitelisted wiki tools as subprocesses
- `GET /api/health` — server health check

## Architecture

- Uses `asynccontextmanager` lifespan for background tasks (state monitor)
- Page content cached with `_page_cache` (dict, max 256 entries, 300s TTL)
- Atomic cache invalidation per page or full clear
- CORS middleware enabled for cross-origin requests
- Structured logging via `logging` module

## Dependencies

- [[FastAPI]] — web framework
- `uvicorn` — ASGI server
- `litellm` — LLM gateway (optional)
- `duckduckgo_search` — web search (optional)
- `yaml` — Python YAML (optional)
- [[MCPManager|mcp_manager]] — MCP server management (optional)
- [[SkillEngine|skill_engine]] — skill execution engine (optional)

## Connections
- [[LLMWikiViewer|wiki-viewer/]] — served as SPA
- [[GraphQueryEngine]] — graph query capabilities
- [[EventBus]] — SSE streaming
- [[JARVIS]] — chat persona
