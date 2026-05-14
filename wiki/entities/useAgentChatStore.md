---
title: "useAgentChatStore"
type: entity
tags: [frontend, typescript, react, zustand, store]
sources: [agent-chat-store-zustand-manager]
last_updated: 2026-05-14
---

# useAgentChatStore

Zustand state management store for the LLM Wiki Viewer's agent execution system. Created via `create<AgentChatState>()`.

## State
- `executions`: [[AgentExecutionState]][] — all executions in current session
- `currentExecution`: [[AgentExecutionState]] | null
- `isConnected`: boolean
- `pendingApprovals`: [[PendingApproval]][] — queue of calls awaiting user approval
- `history`: [[AgentExecutionState]][] — past executions loaded from API
- `historyLoading`: boolean

## Actions
- `startExecution(goal, strategy)` — creates new session
- `updateExecution(sessionId, partial)` — partial state update
- `addStep` / `updateStep` — step CRUD
- `addToolCall` / `updateToolCall` — tool call CRUD
- `addReflection` — append reflection
- `setContent` / `setError` / `setDone` — lifecycle
- `addPendingApproval` / `removePendingApproval` — approval queue
- `loadHistory` — fetch from `/api/jarvis/executions`