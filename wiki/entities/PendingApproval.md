---
title: "PendingApproval"
type: entity
tags: [agent, approval, workflow, typescript]
sources: [agent-chat-store-zustand-manager]
last_updated: 2026-05-14
---

# PendingApproval

Represents a tool call awaiting user approval before execution. Managed by [[useAgentChatStore]].

## Properties
- `req_id`: string — unique request ID
- `step_id`: string — links to [[AgentStep]].id
- `tool_name`: string
- `params`: `Record<string, unknown>`
- `risk_level`: string
- `reason`: string — justification for requiring approval
- `created_at`: number — Unix timestamp