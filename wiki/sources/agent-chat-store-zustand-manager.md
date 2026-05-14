---
title: "Agent Chat Store — Zustand Manager for Agent Execution State"
type: source
tags: [frontend, typescript, react, zustand, agent, execution, state-management]
date: 2026-05-14
source_file: agentChatStore.ts
---

## Summary
The `useAgentChatStore` is a Zustand-based state management store for the LLM Wiki Viewer's agent execution system. It manages full [[AgentExecutionState]] lifecycle — start, update steps/tool calls/reflections, error handling, completion, and history loading. Supports approval workflows via [[PendingApproval]] queue.

## Key Claims
- **Full execution lifecycle**: `startExecution` (creates session with `planning` status) → `addStep`, `addToolCall`, `addReflection` → `setDone` or `setError`. Status transitions: `idle` → `planning` → `executing` → `reflecting` → `summarizing` → `done` | `error`.
- **Immutability via Zustand**: All mutations use `set()` with immutable updates, ensuring [[React]] re-renders correctly.
- **Approval workflow**: `addPendingApproval` / `removePendingApproval` manage a queue of high-risk tool calls awaiting user consent, enabling safe autonomous execution.
- **History persistence**: `loadHistory` fetches past executions from `/api/jarvis/executions` and stores them in `history` array; handles errors gracefully by setting `historyLoading: false`.
- **Session ID generation**: Uses `goal_${Date.now()}_${random(4)}` format for unique, human-readable execution identifiers.

## Key Quotes
> "`const session_id = \`goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}\`;`" — session ID generation pattern
> "`const updateExec = (e: AgentExecutionState) => e.session_id === sessionId ? { ...e, ...partial } : e;`" — immutable update pattern
> "`const executions = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];`" — robust API response parsing

## Connections
- [[AgentExecutionState]] — the core state object managed by this store
- [[AgentStep]] — individual execution steps with status, reasoning, alternatives
- [[AgentToolCall]] — tool invocation tracking per step
- [[AgentReflection]] — agent self-reflection entries
- [[PendingApproval]] — risk-gated tool calls awaiting user approval
- [[useAgentChat]] — consumer of this store
- [[ChatPage]] — likely frontend consumer displaying agent execution
- [[Zustand]] — underlying state management library
- [[useChat]] — companion state management for chat messages

## Contradictions
- None found.