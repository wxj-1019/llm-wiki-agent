---
title: "AgentExecutionLifecycle"
type: concept
tags: [agent, execution, lifecycle, state-machine]
sources: [agent-chat-store-zustand-manager, useagentchat-agent-execution-chat-hook]
last_updated: 2026-05-14
---

# AgentExecutionLifecycle

State machine pattern for agent execution sessions. Defined in [[useAgentChatStore]] and consumed by [[useAgentChat]].

## States
- `idle` → `planning`: upon `startExecution`
- `planning` → `executing`: after plan is created
- `executing` → `reflecting`: after tool results received
- `reflecting` → `summarizing`: before producing final output
- `summarizing` → `done`: after content is generated
- Any state → `error`: on failure

## Transitions
Triggered via `updateExecution` in the store. Each step within an execution has its own sub-status (`pending` → `running` → `completed/failed/skipped/awaiting_approval`).