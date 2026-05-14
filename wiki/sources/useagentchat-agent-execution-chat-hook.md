---
title: "useAgentChat — Agent Execution Chat Hook"
type: source
tags: [frontend, typescript, react, hook, agent, sse, execution]
date: 2026-05-14
source_file: useAgentChat.ts
---

## Summary
The `useAgentChat` hook (`useAgentChat.ts`) enables streaming Agent execution via SSE in the [[LLMWikiViewer]] frontend. It connects to `/api/agent/chat`, parses multi-event SSE streams (plan→step_start→approval_required→tool_call→tool_result→reflection→content→done/error), and dispatches all state mutations to the [[AgentChatStore]] Zustand store. Supports user abort via [[AbortController]], strategy selection, and pending approval workflows.

## Key Claims
- **Full Agent execution lifecycle**: Manages a state machine across `plan`→`step_start`→`tool_call`→`tool_result`→`reflection`→`content`→`done`/`error` events, mapping each to the corresponding store action (`startExecution`, `updateExecution`, `addStep`, `updateStep`, `addToolCall`, `updateToolCall`, `addReflection`, `setContent`, `setDone`, `setError`, `setConnected`).
- **SSE parsing**: Implements event-driven SSE parsing with `<event>: ...` and `<data>: ...` regex extraction, splitting on `\n\n` boundaries. Uses `AbortController` for clean disconnect/reconnect.
- **Approval workflow**: Handles `approval_required` events by adding pending approvals with risk levels (default `L3`), tool name, params, and reason to the store. The hook itself does not auto-approve—delegates to the store/UI layer.
- **Abort support**: `abortRef` holds a mutable [[AbortController]] reference. `disconnect()` aborts any in-flight fetch and resets the connected state. Reconnecting automatically aborts the previous session.
- **Configurable strategy**: Accepts a `strategy` parameter (default `'balanced'`) and custom `options` passed through to the API as-is.

## Key Quotes
> "Handles approval_required events by adding pending approvals with risk levels" — execution events integrate with human-in-the-loop approval
> "AbortController for clean disconnect/reconnect" — supports user abort mid-execution

## Connections
- [[AgentChatStore]] — Zustand store that holds all agent execution state; the hook is the only writer to this store
- [[ChatPage]] — likely consumer, providing the UI for displaying agent executions
- [[ChatConversation]] — may render agent execution steps as chat messages
- [[SSEStreamProtocol]] — the SSE streaming pattern used across the wiki viewer
- [[AbortController]] — standard Web API used for cancellation
- [[ToolCall]] — concept of tool invocation within agent execution
- [[ApprovalWorkflow]] — human-in-the-loop approval for high-risk tool calls

## Contradictions
- No contradictions with existing wiki content.