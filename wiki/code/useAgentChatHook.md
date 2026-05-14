---
title: "useAgentChat Hook"
type: code_func
tags: [typescript, react, hook, agent, sse]
sources: [useagentchat-agent-execution-chat-hook]
last_updated: 2026-05-14
---

# `useAgentChat()`

**Signature:** `function useAgentChat(): { connect: (opts: AgentChatOptions) => Promise<void>, disconnect: () => void }`

Custom React hook for streaming Agent execution via SSE. Manages the full execution lifecycle and dispatches state to [[AgentChatStore]].

## Parameters

### `AgentChatOptions`
| Field | Type | Default | Description |
|---|---|---|---|
| `description` | `string` | — | Human-readable description of the execution goal |
| `strategy` | `string` | `'balanced'` | Execution strategy passed to the API |
| `options` | `Record<string, unknown>` | `{}` | Additional options forwarded to the API |

## Returns

| Method | Description |
|---|---|
| `connect(opts)` | Starts a new agent execution session, connects to `/api/agent/chat`, and processes SSE events into store mutations |
| `disconnect()` | Aborts any in-flight request and resets connected state |

## Internal Detail

- Uses [[AbortController]] stored in `abortRef` for cancellation.
- Imports all store actions from [[AgentChatStore]] via individual selectors (`startExecution`, `updateExecution`, `addStep`, etc.).
- SSE parsing: splits buffer on `\n\n`, extracts `event:` and `data:` lines via regex, parses JSON data.
- Supported SSE event types: `plan`, `step_start`, `approval_required`, `tool_call`, `tool_result`, `reflection`, `content`, `done`, `error`.
- Handles `AbortError` silently (no error state set) on intentional disconnect.

## Related Code Pages
- [[ChatPage]] — likely consumer
- [[ChatConversation]] — may render agent execution
- [[AgentChatStore]] — state store interface
- [[SSEStreamProtocol]] — protocol used for streaming