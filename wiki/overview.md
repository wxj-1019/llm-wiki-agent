---
title: "Overview"
type: synthesis
tags: []
sources: [attention-is-all-you-need, intro-to-llms, github-hermes-ecosystem]
last_updated: 2026-05-04
---

# Overview

*This page is maintained by the LLM. It is updated on every ingest to reflect the current synthesis across all sources.*

## Current Wiki State

The wiki contains **3 sources**, **20 entities**, **6 concepts**, and **2 syntheses** — a total of 32 pages forming a knowledge graph centered on the Transformer architecture, large language models, the emerging AI Agent ecosystem, and alternative sequence modeling paradigms.

### Sources
- [[attention-is-all-you-need|Attention Is All You Need]] — the seminal paper introducing the Transformer architecture
- [[intro-to-llms|Introduction to Large Language Models]] — a comprehensive overview of LLMs
- [[github-hermes-ecosystem|GitHub Hermes 生态系统综述]] — GitHub 上 Hermes 相关项目的全面调研

### Key Themes
1. **The Transformer Architecture** — The foundational innovation that replaced recurrence with self-attention, enabling parallel training and better handling of long-range dependencies.
2. **Large Language Models** — The evolution from GPT through BERT, T5, LLaMA to GPT-4, with increasing scale, multimodal capabilities, test-time compute, and alignment techniques.
3. **AI Agents & Self-Improvement** — The next frontier: autonomous AI agents like [[HermesAgent]] that learn from experience, create reusable skills, and improve over time through self-evolution loops.
4. **AI Alignment & Safety** — Critical techniques (RLHF, Constitutional AI) and emerging risks (reward hacking, catastrophic forgetting) as agents gain autonomy.
5. **Beyond Transformers** — Alternative architectures like [[StateSpaceModels|Mamba and State Space Models]] that challenge the quadratic scaling of attention with linear-time recurrence.

### The Hermes Ecosystem
GitHub 上的 Hermes 项目横跨两大领域：

| 领域 | 项目 | 说明 |
|---|---|---|
| **AI Agent** | [[HermesAgent]] | NousResearch 的自我进化 Agent，支持 200+ 模型 |
| **JS Engine** | [[HermesJSEngine]] | Meta 的 React Native JS 引擎 |
| **Web UI** | hermes-webui | Web/手机端 Agent 界面 |
| **Workspace** | hermes-workspace | 原生 Web 工作区 |
| **自我进化** | hermes-agent-self-evolution | DSPy+GEPA 进化框架 |
| **邮件模板** | matcornic/hermes | Go 语言邮件 HTML 生成器 |

### New & Expanded Concepts
- [[AgentFrameworkComparison]] — 主流 AI Agent 框架横向对比（Hermes Agent、LangChain、AutoGen、CrewAI、Semantic Kernel）
- [[AIAlignment]] — AI 安全与价值对齐技术（RLHF、Constitutional AI、agentic 风险）
- [[StateSpaceModels]] — Transformer 之外的序列建模架构（Mamba、Hyena、Griffin）

### Syntheses
- [[foundation-models-overview|Foundation Models Overview]] — overview of large-scale AI foundation models and the Transformer era

### Key Connections Across Sources
- [[HermesAgent]] 使用 [[OpenAI]]、Anthropic 等多种 LLM 提供商，与 [[LargeLanguageModels]] 发展密切相关
- [[HermesJSEngine]] 由 [[Google]] 之外的另一科技巨头 [[Meta]] 开发，体现了大厂对基础架构的投资
- [[AIAgent]] 概念正在成为继 Transformer 之后 AI 领域的下一个重大范式转变
- [[AIAlignment]] 安全问题随着 [[SelfImprovingAI]] 自我改进能力的增强而日益紧迫
- [[StateSpaceModels]] 为代表的新型架构正在挑战 [[Transformer]] 在长序列建模上的垄断地位
