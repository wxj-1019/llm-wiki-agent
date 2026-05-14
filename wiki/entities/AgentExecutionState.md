---
title: "AgentExecutionState"
type: entity
tags: [agent, execution, state, typescript]
sources: [agent-chat-store-zustand-manager]
last_updated: 2026-05-14
---

# AgentExecutionState

Core state object managed by [[useAgentChatStore]]. Represents the full lifecycle of a single agent execution session.

## Properties
- `session_id`: string — unique identifier in format `goal_<timestamp>_<random>`
- `goal`: string — the original user goal
- `strategy`: string — execution strategy name
- `status`: `'idle' | 'planning' | 'executing' | 'reflecting' | 'summarizing' | 'done' | 'error'`
- `steps`: [[AgentStep]][] — ordered list of execution steps
- `tool_calls`: [[AgentToolCall]][] — tool invocations with status
- `reflections`: [[AgentReflection]][] — agent self-reflection entries
- `content`: string — accumulated output content
- `error`: string | null
- `started_at`: number
- `finished_at`: number | null

## Session ID Format
`goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`