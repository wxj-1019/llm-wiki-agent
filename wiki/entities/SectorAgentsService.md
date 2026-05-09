---
title: "SectorAgentsService"
type: entity
tags: [ai-agent, sector-analysis, token-usage]
sources: [sector-strategy-and-market-analysis]
last_updated: 2026-05-09
---

# SectorAgentsService

AI板块分析多智能体服务，由[[SectorStrategyService]]调用，为[[板块策略与大盘分析]]模块提供AI驱动的板块综合分析。

## 分析维度
- 板块资金流向
- 成分股强度
- 行业景气度
- 政策催化
- 风险因素

## 设计特点
- AI分析Token独立统计并持久化到`UserTokenUsageRecord`
- 多智能体协作模式

## Connections
- [[AIMultiAgentStockAnalysis]] — AI多智能体在板块分析中的具体应用
- [[UserProfiling]] — Token使用统计与用户画像关联