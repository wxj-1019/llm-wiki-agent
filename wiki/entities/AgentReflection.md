---
title: "AgentReflection"
type: entity
tags: [agent, reflection, typescript]
sources: [agent-chat-store-zustand-manager]
last_updated: 2026-05-14
---

# AgentReflection

Represents an agent self-reflection entry within [[AgentExecutionState]]. Managed by [[useAgentChatStore]].

## Properties
- `text`: string — reflection content
- `timestamp`: number — Unix timestamp