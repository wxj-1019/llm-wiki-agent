---
title: "ChatMessage"
type: entity
tags: [typescript, type, chat]
sources: [usechat-agent-kit-chat-state-management-hook]
last_updated: 2026-05-14
---

The `ChatMessage` interface in [[useChat]] extends the base `ChatMessage` type from [[agentKitLLMService]]:

```typescript
export interface ChatMessage extends BaseChatMessage {
  knowledgeGen?: boolean;
  code?: string;
}
```

Additional fields:
- `knowledgeGen`: indicates this message was generated via the knowledge generation pathway (MCP/Skill)
- `code`: contains the generated code content for MCP or Skill files

The base `ChatMessage` from `agentKitLLMService` includes:
- `role`: `'user' | 'assistant'`
- `content`: the message text content