---
title: Lazy Backend Initialization
slug: LazyBackendInitialization
type: concept
tags: [pattern, initialization, threading]
sources: [wiki-mcp-server-mcp-stdio-server]
last_updated: 2026-05-14
---

# Lazy Backend Initialization

Lazy Backend Initialization is a pattern used by the [[WikiMCPServer|wiki-mcp-server]] to postpone the creation of the search backend until it is first needed. It uses double-checked locking with a module-level lock (`_mcp_search_backend_lock`) to ensure thread safety while minimizing synchronization overhead.

## Implementation in the Wiki MCP Server

The `_get_mcp_search_backend()` function checks a global `_mcp_search_backend` variable; if `None`, it acquires a lock and creates the backend via `from tools.shared.search_backend import get_search_backend`. This avoids initializing the backend at import time, reducing startup latency.

## Connections

- [[SearchBackend]] — the interface being lazily initialized
- [[WikiMCPServer|wiki-mcp-server]] — the server that implements this pattern
- [[Double-Checked Locking]] — related concurrent pattern