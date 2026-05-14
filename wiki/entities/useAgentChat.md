---
title: "useAgentChat"
type: entity
tags: []
sources: [overview.md, UseAgentChatStore.md, agent-chat-store-zustand-manager.md]
---

# useAgentChat

`useAgentChat` refers to the overarching concept of an AI agent conversation system within the LLM Wiki Viewer, as distinct from a simple incremental chat. It encompasses the full lifecycle management of agent execution sessions, where the AI does not merely respond to prompts but plans, executes tool calls, reflects on results, and manages approval workflows. The primary implementation of this concept is the `useAgentChatStore` — a Zustand-based state management store that orchestrates execution sessions from `idle` through `planning`, `executing`, and `reflecting` states, tracking individual steps, tool calls, reflections, and pending approvals along the way. This store is the bridge between the user's request and the agent's autonomous reasoning loop, providing both real-time status updates and history loading. Unlike simple chat history, `useAgentChat` implies structured, multi-step problem solving with observable intermediate actions and human-in-the-loop approval points.