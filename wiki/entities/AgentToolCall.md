---
title: "AgentToolCall"
type: entity
tags: [agent, execution, tool-call, typescript]
sources: [agent-chat-store-zustand-manager]
last_updated: 2026-05-14
---

# AgentToolCall

Tracks a tool invocation within an [[AgentExecutionState]]. Part of [[useAgentChatStore]] state.

## Properties
- `step_id`: string — links to [[AgentStep]].id
- `tool_name`: string
- `params`: `Record<string, unknown>`
- `status`: `'running' | 'success' | 'failed' | 'awaiting_approval'`
- `result`: string (optional)
- `duration_ms`: number (optional)