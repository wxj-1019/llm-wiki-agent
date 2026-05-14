---
title: "agentKitLLMService"
type: entity
tags: [service, llm, agent-kit]
sources: [usechat-agent-kit-chat-state-management-hook]
last_updated: 2026-05-14
---

The `agentKitLLMService` module (`src/services/agentKitLLMService.ts`) provides the backend communication layer for the [[AgentKit]] chat interface. Exports:
- `chatWithLLMStream(messages, systemPrompt?, signal?)` — streams LLM responses for free-form chat
- `generateFromKnowledge(content, target)` — generates MCP or Skill content from wiki knowledge, returning `{ explanation, code, sources }`
- `readAgentKitFile(path)` — reads a file from the agent kit directory
- `saveAgentKitFile(path, content)` — saves content to a file in the agent kit directory

The `knowledgeGenTarget` parameter accepts `'mcp'` or `'skill'`. The `sources` array contains wiki knowledge sources used during generation.

Types:
- `ChatMessage` — `{ role: 'user' | 'assistant', content: string }`
- `KnowledgeSource` — wiki source metadata returned by generation