---
title: "AIMultiAgentStockAnalysis"
type: concept
tags: [ai, stock-analysis, multi-agent]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-08
---

# AIMultiAgentStockAnalysis

[[AIAgent|AI多智能体]]在股票分析中的应用范式。在[[main-fund-selection-system|主力选股系统]]中，5位AI分析师（资金流向、行业板块、财务基本面、技术形态、量化）通过asyncio.Semaphore并行执行，资深研究员汇总输出推荐。

## Multi-Agent vs Single-Agent

多智能体架构相比单智能体具有更好的可解释性和分工清晰性。每个分析师专注于特定维度，减少幻觉和维度遗漏。

## 关键设计

- 统一输入格式（基础面、技术面、量化评分）
- 独立超时控制和熔断器
- Token消耗联合追踪

## Connections

- [[main-fund-selection-system]] — 主力选股系统的核心智能层
- [[QuantPreScoring]] — 量化预评分前置过滤
- [[LLM|大语言模型]] — 分析师的基础模型