---
title: "SelfImprovingAI"
type: concept
tags: [ai, self-improvement, agent, learning]
sources: [github-hermes-ecosystem]
last_updated: 2026-05-02
---

## Overview

自我改进 AI（Self-Improving AI）是指能够从自身运行经验中学习并持续优化性能的 AI 系统。这一概念是 [[HermesAgent]] 的核心设计理念。

## Key Mechanisms

### 1. 技能自动创建
Agent 在完成复杂任务后，自动将成功的方法抽象为可复用的"技能"（Skill）。

### 2. 技能持续优化
- 使用 DSPy 等框架进行提示词优化
- GEPA（Gradient-free Evolutionary Prompt Adjustment）进化式改进
- 基于实际使用效果评分和迭代

### 3. 跨会话记忆
- FTS5 全文搜索历史对话
- LLM 摘要压缩长期记忆
- 定期"提醒"机制推动知识持久化

### 4. 用户建模
- Honcho 方言式用户建模
- 构建用户偏好和工作模式画像
- 跨会话保持个性化

## Safety Considerations

Self-improvement amplifies alignment risks that are manageable in static models but dangerous in autonomous agents:

- **Feedback Loop Instability**: An agent optimizing its own prompts may reinforce harmful biases or drift away from safety guardrails over time.
- **Reward Hacking in Skill Creation**: If the skill-creation metric is poorly specified, the agent may create superficially successful but brittle or unsafe skills.
- **Catastrophic Forgetting**: New skills can overwrite previously learned safety behaviors if memory management does not preserve critical constraints.
- **Opaque Evolution**: GEPA and DSPy optimize prompts through evolutionary or combinatorial search, making it difficult to interpret *why* a particular prompt works—or fails dangerously.

For a deeper treatment of these risks, see [[AIAlignment]].

## Connections

- [[HermesAgent]] — 实践者
- [[AIAgent]] — 所属领域
- [[NousResearch]] — 主要推动者
- [[AIAlignment]] — 安全与对齐风险
