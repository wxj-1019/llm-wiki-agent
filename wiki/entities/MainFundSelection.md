---
title: "MainFundSelection"
type: entity
tags: [stock-selection, ai-system, finance]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-07
---

# MainFundSelection

主力选股系统，一个[[AIAgent|AI驱动的]]旗舰智能选股系统，采用六层流水线架构，从全市场主力资金流入股票中每日精选3-10只最优标的。

## Key Facts

- 六层架构：数据获取 → 多层级筛选 → 量化预评分 → AI五维分析 → 资深研究员综合 → 回测验证
- 集成7种选股策略（主力吸筹、短期爆发、价值稳健、成长潜力、板块轮动、低风险收益、温和回调多头）
- 5位[[AIAgent|AI分析师]]并行工作：资金流向、行业板块、财务基本面、技术形态、量化
- 使用[[WencaiAPI]]和[[Tushare]]作为数据源

## Connections

- [[AIAgent]] — 核心智能驱动层
- [[LargeLanguageModels]] — AI分析师和研究员基于LLM
- [[QuantitativeAnalysis]] — 量化预评分系统
- [[Backtesting]] — 自动回测验证
- [[RiskManagement]] — 多层防御式筛选
- [[WencaiAPI]] — 主数据源
- [[Tushare]] — 备选数据源