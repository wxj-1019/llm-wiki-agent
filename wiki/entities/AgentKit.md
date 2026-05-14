---
title: "AgentKit"
type: entity
tags: [agent-kit, chat, react, frontend, llm]
sources: [useChatHook.md, usechat-agent-kit-chat-state-management-hook.md]
---

# AgentKit

`AgentKit` is a core entity in the LLMWikiViewer ecosystem, representing the AI-powered chat interface and its underlying infrastructure. It provides the chat environment where users interact with both free-form LLM conversations and knowledge-based generation workflows. The AgentKit manages the full chat state lifecycle, including streaming LLM responses, dual-mode chat (general conversation versus structured knowledge generation), quick prompts for code review and tool suggestions, chat persistence via LocalStorage, and tight integration with the wiki viewer's editor and preview systems. It communicates with backend services through the `agentKitLLMService` and relies on utility components like `StreamDeduplicator` to manage streaming responses efficiently. In the frontend codebase, `AgentKit` is primarily accessed via the `useChat()` hook, which orchestrates all chat state management, message history, and interaction with the knowledge-generation subsystem.