---
title: "AgentStep"
type: entity
tags: [agent, execution, step, typescript]
sources: [agent-chat-store-zustand-manager]
last_updated: 2026-05-14
---

# AgentStep

Represents a single step within an [[AgentExecutionState]]. Each step corresponds to a tool call with its reasoning, alternatives, and result.

## Properties
- `id`: string
- `tool_name`: string — name of the tool being invoked
- `params`: `Record<string, unknown>`
- `status`: `'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'awaiting_approval'`
- `risk_level`: string (optional)
- `confidence`: number (optional)
- `reasoning`: [[ReasoningStep]][] (optional) — textual reasoning with optional evidence
- `alternatives`: [[AlternativeAction]][] (optional) — alternative actions considered
- `decision`: string (optional)
- `result`: object (optional) — `{ success: boolean, data?: unknown, error?: string, duration_ms?: number }`