---
title: "AgentChatStore"
type: entity
tags: [zustand, store, agent, execution]
sources: [useagentchat-agent-execution-chat-hook]
last_updated: 2026-05-14
---

# AgentChatStore

The [[AgentChatStore]] is a Zustand store located at `@/stores/agentChatStore` that manages Agent execution state in the [[LLMWikiViewer]] frontend. It is exclusively written to by the [[useAgentChat]] hook and provides actions for all execution lifecycle events: `startExecution`, `updateExecution`, `addStep`, `updateStep`, `addToolCall`, `updateToolCall`, `addReflection`, `setContent`, `setDone`, `setError`, `setConnected`, and `addPendingApproval`.

## Related
- [[useAgentChat]] — primary consumer and writer
- [[ChatPage]] — likely renders agent execution state from this store