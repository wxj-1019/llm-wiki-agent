---
title: "MCP"
type: entity
tags: [model-context-protocol, protocol, tools, server, integration]
sources: [ChatPage.md, chatinput-chat-input-component.md, chatpage-chat-interface-component.md, wiki-mcp-server-mcp-stdio-server.md]
---

# MCP

**MCP** stands for **Model Context Protocol**, an open protocol that standardizes how AI applications provide context and tools to large language models. Within the LLMWikiViewer ecosystem, MCP serves a dual role. First, it is a **target output format**: the application's "generate from knowledge" feature allows users to create MCP-compatible packages, as seen in the ChatPage and ChatInput components, which include a dedicated "Generate [[MCP]]" button alongside a similar "Generate [[Skill]]" button. Second, and more substantially, the project provides a production-grade **MCP stdio server** (`mcp_server.py`) that exposes the entire LLM Wiki to MCP-compatible hosts (such as [[ClaudeCode]], Cursor, and VS Code). This server implements wiki search, read, write, list, ingest, memory, and context-building capabilities as MCP Resources, Tools, and Prompts, along with specialized prompt templates for summarization, comparison, and contradiction detection. Configurable via desktop configuration files, the wiki MCP server effectively turns the knowledge base into a tool-accessible resource for any MCP-compatible AI agent, bridging the gap between the wiki's stored knowledge and conversational AI interfaces.