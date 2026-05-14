---
title: MCP Stdio Transport
slug: MCPStdioTransport
type: concept
tags: [MCP, protocol, transport]
sources: [wiki-mcp-server-mcp-stdio-server]
last_updated: 2026-05-14
---

# MCP Stdio Transport

The MCP Stdio Transport is the standard communication mechanism for MCP servers that run as subprocesses. The server communicates via stdin/stdout using JSON-RPC messages. This is the transport used by the [[WikiMCPServer|wiki-mcp-server]] and supported by [[ClaudeCode|Claude Code]], Cursor, and VS Code MCP runners.

## Key Characteristics

- **Platform independence**: Works on all operating systems without network configuration.
- **Process isolation**: Each MCP server runs as a separate process.
- **JSON-RPC over stdio**: All requests and responses are JSON-formatted.
- **Lifecycle**: MCP host spawns the server process, communicates via stdio, and terminates it on shutdown.

## Connections

- [[FastMCP]] — the server framework that implements stdio transport
- [[MCP]] — the Model Context Protocol
- [[WikiMCPServer|wiki-mcp-server]] — concrete implementation