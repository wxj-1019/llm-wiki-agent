---
title: "ApprovalWorkflow"
type: concept
tags: [agent, approval, safety, workflow]
sources: [agent-chat-store-zustand-manager, useagentchat-agent-execution-chat-hook]
last_updated: 2026-05-14
---

# ApprovalWorkflow

Risk-gated execution pattern where high-risk tool calls require user consent before execution.

## Flow
1. Agent emits a step with `status: 'awaiting_approval'`
2. A [[PendingApproval]] is added to the store's queue
3. UI displays approval dialog with risk level, tool name, params, and reason
4. User approves (removes from queue, step continues) or rejects (step marked `skipped` or `failed`)

## Design Decisions
- Queue is separate from execution state for clear separation of concerns
- Approval reason explains why the call is risk-gated (e.g., "modifying production data", "high monetary value")
- The agent can provide alternatives before requiring approval