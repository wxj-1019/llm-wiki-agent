---
title: Memory
slug: Memory
type: entity
tags: [tools, persistence]
sources: [wiki-mcp-server-mcp-stdio-server]
last_updated: 2026-05-14
---

# Memory

The Memory system provides persistent task memory sessions for the LLM Wiki. The [[WikiMCPServer|wiki-mcp-server]] exposes MCP tools (`wiki_memory_start`, `wiki_memory_update`, `wiki_memory_finish`, `wiki_memory_list`) to create, update, finish, and list memory sessions.

## Connections

- [[WikiMCPServer|wiki-mcp-server]] — exposes memory tools via MCP
- [[Context]] — related tool for building context packs
