---
title: "DualModeChat"
type: concept
tags: [chat, architecture, pattern]
sources: [usechat-agent-kit-chat-state-management-hook]
last_updated: 2026-05-14
---

Dual-mode chat is an architectural pattern in the [[AgentKit]] where the same chat interface supports two distinct interaction modes:

1. **Free-form LLM chat**: Standard conversational interaction using `chatWithLLMStream`. The user asks questions, gets responses, and can stop generation via abort. Used for general Q&A, code review, and tool suggestions.

2. **Knowledge-based generation**: Activated via `startKnowledgeGen(target)` which sets a `knowledgeGenTarget`. Subsequent `handleSendChat` calls are routed to `generateFromKnowledge` instead of the normal streaming path. Used for generating MCP servers and Skills from wiki knowledge.

In the [[useChat]] implementation, the mode switch happens at the beginning of `handleSendChat`: if `knowledgeGenTarget` is non-null, the function calls `generateFromKnowledge` and returns early, bypassing the normal streaming path.

After generation completes, `knowledgeGenTarget` is reset to `null`, returning the chat to free-form mode.