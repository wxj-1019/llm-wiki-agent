---
title: "MainFundSelectionSystem"
type: entity
tags: [stock-selection, ai-system, quant]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-08
---

# MainFundSelectionSystem

主力选股系统是一个[[AIAgent|AI驱动的]]旗舰智能选股系统，采用六层流水线架构，从全市场主力资金流入股票中每日精选3-10只最优标的。

## 核心架构

六层流水线：数据获取 → 多层级筛选 → 量化预评分 → AI五维分析 → 资深研究员综合 → 回测验证

## 关键子系统

- 7种选股策略（主力吸筹、短期爆发、价值稳健、成长潜力、板块轮动、低风险收益、温和回调多头）
- [[QuantitativeAnalysis|量化预评分系统（Quant Scorer）]]从资金强度、量价配合、基本面、估值安全四个维度评分
- 5位[[AIAgent|AI分析师]]并行分析
- 推荐分层双轨制（优先推荐/谨慎参考）
- 自动回测验证引擎

## Connections

- [[WencaiAPI]] — 主要数据源（问财API）
- [[Tushare]] — 备选数据源和技术指标提供者
- [[Backtesting]] — 回测验证系统
- [[RiskManagement]] — 风控体系
- [[DataPipeline]] — 数据管道