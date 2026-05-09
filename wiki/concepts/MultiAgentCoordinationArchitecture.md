---
title: "Multi-Agent Coordination Architecture"
type: concept
tags: [ai, multi-agent, architecture]
sources: [ai-intelligent-analysis-system]
last_updated: 2026-05-09
---

## Summary

多智能体协同架构（Multi-Agent Coordination Architecture）是[[ai-intelligent-analysis-system|AI智能分析系统]]的核心设计模式，采用Facade外观模式封装多个AI分析师智能体，实现三阶段分析流水线：多智能体并发分析（阶段一）→ 团队讨论综合模拟投研会议（阶段二）→ 最终投资决策（阶段三）。系统包含9个专业分析师智能体：[[TechnicalAnalystAgent]]、[[FundamentalAnalystAgent]]、[[FundFlowAnalystAgent]]、[[RiskAnalystAgent]]、[[NewsAnalystAgent]]、[[SentimentAnalystAgent]]、[[MacroAnalystAgent]]、[[QuantitativeAnalystAgent]]、[[EventAnalystAgent]]。所有智能体默认并发执行（300秒超时），每个输出分析摘要+评级+关键指标，最后综合生成统一决策（rating/action/target_price/stop_loss/confidence/时间框架）。

## Related Concepts

- [[AIAgent]] — AI智能体基础概念
- [[AIMultiAgentStockAnalysis]] — 在股票分析中的应用
- [[DataPipeline]] — 数据管道集成
- [[RiskManagement]] — 风险管理