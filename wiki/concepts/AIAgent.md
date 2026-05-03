---
title: "AIAgent"
type: concept
tags: [ai, agent, automation, llm]
sources: [github-hermes-ecosystem]
last_updated: 2026-05-02
---

## Overview

AI Agent（人工智能代理）是一种能够自主感知环境、做出决策并执行行动以实现特定目标的 AI 系统。与传统聊天机器人不同，AI Agent 具备工具调用、记忆持久化、多步推理和自我改进等能力。

## Key Characteristics

### 工具调用（Tool Use）
- Agent 可以调用外部工具（搜索、代码执行、文件操作等）
- 通过结构化接口（如 function calling）与工具交互

#### Tool Taxonomy
- **Static Tools**: Pre-defined function schemas with fixed signatures (e.g., `get_weather(city: str)`). The agent selects from a known catalog at runtime.
- **Dynamic Tools**: Generated on-the-fly, often via code synthesis (e.g., writing a custom pandas script to analyze a CSV). Requires execution sandboxing to prevent harm.
- **External APIs**: Third-party services (web search, database queries, cloud compute). Agent must manage authentication, rate limits, and error handling.

#### Security & Isolation
Allowing an agent to execute arbitrary code or access external systems introduces significant risks:
- **Sandboxing**: Tools should run inside isolated environments (Docker containers, gVisor, WebAssembly) to limit filesystem and network access.
- **Permission Boundaries**: Principle of least privilege — the agent should only have access to the specific resources it needs for a task.
- **Human-in-the-Loop**: Destructive or high-stakes operations (deleting data, sending emails, financial transactions) should require explicit user approval before execution.

### 记忆系统（Memory）
- 短期记忆：当前对话上下文
- 长期记忆：跨会话持久化存储
- 技能记忆：从经验中学习的可复用程序

#### Memory Limitations & Techniques
- **Memory Decay**: Long-term memory is not perfect. Irrelevant or old information can drown out useful knowledge. Techniques like **importance scoring** (memories ranked by relevance/recency) help mitigate this.
- **Retrieval Accuracy**: Keyword-based retrieval (e.g., FTS5) often fails for complex semantic queries. Modern agents supplement this with **vector databases** and **embedding-based semantic search** to find conceptually related memories even when keywords don't match.
- **Context Window Bottleneck**: Even with perfect retrieval, an agent can only fit a limited amount of text into its working context. Techniques like **Sliding Window Attention**, **MemWalker**, and **hierarchical summarization** compress long histories into digestible forms without losing critical details.

### 规划与推理（Planning & Reasoning）
- 将复杂任务分解为子步骤
- 支持并行执行和条件分支
- 动态调整计划以应对失败

### 自我改进（Self-Improvement）
- 从成功和失败中学习
- 自动创建和优化技能
- 跨会话知识积累

## Notable Projects

| 项目 | Stars | 特点 |
|---|---|---|
| [[HermesAgent]] | 128,747 | 自我进化、多模型、多平台 |
| OpenAI Codex | — | OpenAI 官方 Agent |
| Claude Code | — | Anthropic 编程 Agent |

## Connections

- [[HermesAgent]] — 代表性项目
- [[SelfImprovingAI]] — 核心理念
- [[NousResearch]] — 主要推动者
- [[LargeLanguageModels]] — 底层技术基础
- [[AgentFrameworkComparison]] — 主流框架对比
