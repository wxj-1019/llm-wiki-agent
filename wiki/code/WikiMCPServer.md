---
title: Wiki MCPServer Module
type: code_module
tags: [MCP, server, wiki]
sources: [wiki-mcp-server-mcp-stdio-server]
last_updated: 2026-05-14
---

# Wiki MCP Server Module

## Path
`tools/mcp_server.py`

## Purpose
Production-ready MCP stdio server that exposes the LLM Wiki as MCP Resources, Tools, and Prompts. Designed for integration with MCP-compatible hosts.

## Key Functions

### Core Helpers

- `_safe_wiki_path(rel: str) -> Path | None` — validates that a repo-relative path stays within the wiki directory, resolving symlinks and rejecting traversal.
- `_read_page(rel_path: str) -> str` — reads a wiki page by repo-relative path.
- `_list_pages(page_type: str | None) -> list[dict]` — lists wiki pages, optionally filtered by type.
- `_run_ingest(file_path: str) -> dict` — runs `ingest.py` on a file, returns result dict.

### MCP Resources

- `resource_overview() -> str` — resource `wiki://overview`
- `resource_index() -> str` — resource `wiki://index`

### MCP Tools

- `wiki_search(query: str, limit: int = 5) -> str` — keyword search, falls back to substring matching
- `wiki_read(path: str) -> str` — reads a wiki page by repo-relative path
- `wiki_write(path: str, content: str) -> str` — writes a wiki page, appends to log
- `wiki_list(page_type: str | None) -> str` — lists pages, optionally filtered
- `wiki_ingest(file_path: str) -> str` — ingests a file into the wiki
- `wiki_memory_start(goal: str) -> str` — starts a memory session
- `wiki_memory_update(session_id: str, entry: str) -> str` — updates a memory session
- `wiki_memory_finish(session_id: str, outcome: str) -> str` — finishes a memory session
- `wiki_memory_list() -> str` — lists all memory sessions
- `wiki_context_build(goal: str, budget: int = 8000) -> str` — builds a context pack

### MCP Prompts

- `summarize_topic(topic: str) -> str` — structured summarization prompt
- `compare_entities(a: str, b: str) -> str` — structured comparison prompt
- `find_contradictions(topic: str = "all") -> str` — contradiction detection prompt

## Connections

- [[SearchBackend]] — uses search backend for `wiki_search`
- [[Ingest]] — calls ingest via `_run_ingest`
- [[FastMCP]] — the MCP server framework
- [[Memory]] — memory tools
- [[Context]] — context building tool
