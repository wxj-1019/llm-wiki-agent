---
title: "ApprovalWorkflow"
type: entity
tags: [workflow, approval, human-in-the-loop]
sources: [useagentchat-agent-execution-chat-hook]
last_updated: 2026-05-14
---

# ApprovalWorkflow

The [[ApprovalWorkflow]] is a human-in-the-loop approval mechanism integrated into the [[LLMWikiViewer]] Agent execution system. When a tool call carries elevated risk, the server emits an `approval_required` SSE event. The [[useAgentChat]] hook stores these pending approvals with risk level (default `L3`), tool name, parameters, and reason in the [[AgentChatStore]], delegating the approval UI to the consumer.