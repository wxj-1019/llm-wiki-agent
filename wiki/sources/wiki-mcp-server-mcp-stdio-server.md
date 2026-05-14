---
title: "Wiki MCP Server — MCP stdio Server for LLM Wiki Agent"
type: source
tags: [MCP, tools, server, search, wiki]
date: 2026-05-14
source_file: tools/mcp_server.py
---

## Summary

The `mcp_server.py` script implements a production-ready MCP (Model Context Protocol) stdio server using [[FastMCP]] that exposes the LLM Wiki as MCP Resources, Tools, and Prompts. It provides wiki search, read, write, list, ingest, memory, and context building capabilities, along with prompt templates for summarization, comparison, and contradiction detection. It can be configured in [[ClaudeCode|Claude Code]] (or any MCP-compatible host) via desktop config.

## Key Claims

- **MCP stdio transport**: Runs on stdio, compatible with [[ClaudeCode|Claude Code]], Cursor, VS Code MCP runners. Configured via `mcpServers` in desktop config.
- **Lazy backend loading**: Uses `_get_mcp_search_backend()` with double-checked locking to lazily initialize the [[SearchBackend]] ([[SQLite]] FTS5 or [[PgSearchBackend]]).
- **Path safety**: `_safe_wiki_path()` validates that all file access stays within the `wiki/` directory, resolving symlinks and rejecting traversal attempts.
- **Fallback substring search**: If the FTS backend fails, `wiki_search()` falls back to substring matching across all `.md` files, ensuring robustness.
- **Resource endpoints**: `wiki://overview` and `wiki://index` expose the overview and index as MCP resources.
- **Memory integration**: Tools `wiki_memory_start`, `wiki_memory_update`, `wiki_memory_finish`, `wiki_memory_list` wrap the [[Memory]] system for persistent task sessions.
- **Context building**: `wiki_context_build` wraps the [[Context]] tool to build token-bounded context packs for agents.
- **Prompt templates**: `summarize_topic`, `compare_entities`, and `find_contradictions` provide structured prompt templates for common wiki knowledge tasks.
- **Signal handling**: Gracefully handles `SIGINT`, `SIGTERM`, and Windows `SIGBREAK` for clean shutdown.

## Key Quotes

> "Exposes wiki knowledge as MCP Resources, Tools, and Prompts."

> "Path safety: validates that all file access stays within the wiki/ directory."

## Connections

- [[FastMCP]] — MCP server framework used
- [[MCP]] — the MCP protocol
- [[SearchBackend]] — search backend interface
- [[SQLite]] — default search backend
- [[PgSearchBackend]] — alternative PostgreSQL+pgvector backend
- [[Memory]] — task memory system
- [[Context]] — context pack builder
- [[ClaudeCode|Claude Code]] — primary MCP host
- [[Ingest]] — ingest tool

## Contradictions

None.