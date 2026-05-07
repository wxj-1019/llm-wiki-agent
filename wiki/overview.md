---
title: "Overview"
type: synthesis
tags: []
sources: [attention-is-all-you-need, intro-to-llms, github-hermes-ecosystem, things-we-learned-about-llms-in-2024, main-fund-selection-system-analysis, a-share-quantitative-trading-strategies-guide]
last_updated: 2026-05-07
---

# Overview

*This page is maintained by the LLM. It is updated on every ingest to reflect the current synthesis across all sources.*

## Current Wiki State

The wiki contains **6 sources**, **22 entities**, **13 concepts**, and **3 syntheses** — a total of 44 pages forming a knowledge graph centered on the Transformer architecture, large language models, the emerging AI Agent ecosystem, alternative sequence modeling paradigms, and a practical AI-powered financial stock selection system.

### Sources
- [[attention-is-all-you-need|Attention Is All You Need]] — the seminal paper introducing the Transformer architecture
- [[intro-to-llms|Introduction to Large Language Models]] — a comprehensive overview of LLMs
- [[github-hermes-ecosystem|GitHub Hermes 生态系统综述]] — GitHub 上 Hermes 相关项目的全面调研
- [[things-we-learned-about-llms-in-2024|Things We Learned About LLMs in 2024]] — year-in-review of LLM landscape
- [[main-fund-selection-system-analysis|主力选股系统整体分析文档]] — AI驱动的旗舰智能选股系统六层架构详解
- [[a-share-quantitative-trading-strategies-guide|A股常见量化交易策略指南]] — 全面梳理 14 种 A 股常见量化交易策略，分析其核心逻辑、A 股适用性和实战落地要点

### Key Themes
1. **The Transformer Architecture** — The foundational innovation that replaced recurrence with self-attention, enabling parallel training and better handling of long-range dependencies.
2. **Large Language Models** — The evolution from GPT through BERT, T5, LLaMA to GPT-4, with increasing scale, multimodal capabilities, test-time compute, and alignment techniques.
3. **AI Agents & Self-Improvement** — The next frontier: autonomous AI agents like [[HermesAgent]] that learn from experience, create reusable skills, and improve over time through self-evolution loops.
4. **AI Alignment & Safety** — Critical techniques (RLHF, Constitutional AI) and emerging risks (reward hacking, catastrophic forgetting) as agents gain autonomy.
5. **Beyond Transformers** — Alternative sequence modeling architectures (State Space Models) challenging the Transformer's dominance.
6. **A股量化交易策略体系** — 结合 A 股独特市场特征（涨跌停、T+1、做空限制、政策驱动、题材轮动）的 14 种量化策略框架，已与主力选股系统的策略体系形成互补连接。

### 关键策略优先级
针对当前主力选股系统，新指南建议优先工程化以下四类策略：
- **主力资金流入策略** — 数据可获取、解释性强、贴近 A 股交易行为
- **板块轮动策略** — 符合 A 股题材结构，可结合热度、资金流、龙头识别
- **趋势+动量复合策略** — 信号稳定、回测容易，能减少资金流假信号干扰
- **多因子评分策略** — 适合作为统一底座，汇总资金流、技术、基本面、风控

这些策略与系统现有 7 种选股策略策略形成互补，特别强化了板块轮动和资金流驱动的选股逻辑。