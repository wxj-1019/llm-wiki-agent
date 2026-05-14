---
title: "useAgentChatStore"
type: code_module
tags: [typescript, zustand, store, agent, execution]
sources: [agent-chat-store-zustand-manager]
last_updated: 2026-05-14
---

# useAgentChatStore

**Location:** `agentChatStore.ts`
**Signature:** `export const useAgentChatStore = create<AgentChatState>(...)`

## Purpose
Zustand store managing the full lifecycle of agent execution sessions, including step tracking, tool calls, reflections, approval queue, and history loading.

## State Shape
```typescript
interface AgentChatState {
  executions: AgentExecutionState[];
  currentExecution: AgentExecutionState | null;
  isConnected: boolean;
  pendingApprovals: PendingApproval[];
  history: AgentExecutionState[];
  historyLoading: boolean;
  // + 16 action methods
}
```

## Actions
| Action | Description |
|---|---|
| `startExecution(goal, strategy)` | Creates new session with `planning` status, resets current execution |
| `updateExecution(sessionId, partial)` | Partial immutable update to an execution |
| `addStep` / `updateStep` | Append or modify a single step |
| `addToolCall` / `updateToolCall` | Append or modify a tool call |
| `addReflection` | Append a [[AgentReflection]] |
| `setContent` / `setError` / `setDone` | Lifecycle state transitions |
| `addPendingApproval` / `removePendingApproval` | Approval queue management |
| `loadHistory` | Fetches `/api/jarvis/executions`, robust to non-array responses |

## Key Implementation Details
- Session IDs: `goal_${Date.now()}_${random(4)}`
- All updates use immutable `map` patterns to preserve [[Zustand]] reactivity
- History fetch returns empty array on error (no warnings)
- Related: [[useAgentChat]]