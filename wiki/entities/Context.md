---
title: Context
slug: Context
type: entity
tags: [tools, context-pack]
sources: [wiki-mcp-server-mcp-stdio-server]
last_updated: 2026-05-14
---

# Context

The Context tool builds token-bounded context packs for agents. The [[WikiMCPServer|wiki-mcp-server]] exposes `wiki_context_build` to allow MCP clients to create context packs from the wiki.

## Connections

- [[WikiMCPServer|wiki-mcp-server]] — exposes context building via MCP
- [[Memory]] — related persistence system
