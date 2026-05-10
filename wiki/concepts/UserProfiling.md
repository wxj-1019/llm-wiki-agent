---
title: "UserProfiling"
type: concept
tags: [user-profile, personalization, ai-analysis]
sources: [user-profile-system]
last_updated: 2026-05-09
---

# UserProfiling

**用户画像**是一种通过收集用户多维度行为数据，利用LLM或算法生成用户特征描述的方法。在[[user-profile-system]]中，画像分为4大维度：投资风格、投资偏好、行为特征、能力评估。

## Key Principles

- **多维度采集**：覆盖用户行为的不同侧面
- **AI深度分析**：使用大模型理解行为模式而非简单统计
- **增量更新**：基于最后一次画像做增量数据更新
- **版本历史**：每次生成保存快照，追踪长期趋势

## Connections

- [[MainFundSelection]] — 画像系统的应用平台
- LLM — 画像生成的技术基础
- [[StockSelectionStrategy]] — 画像可驱动策略推荐
- [[QuantitativeAnalysis]] — 画像中的评分系统是量化分析的延伸
- [[AIMultiAgentStockAnalysis]] — AI多智能体分析的补充维度