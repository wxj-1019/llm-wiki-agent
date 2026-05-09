---
title: "MultiFactorSelection"
type: entity
tags: [strategy, multi-factor, quantitative-trading]
sources: [a-share-quantitative-trading-strategies-guide]
last_updated: 2026-05-08
---

多因子选股策略（Multi-Factor Selection）是一种同时从估值、成长、质量、动量、波动率、资金流等多个维度给股票打分，再综合排序选股的量化方法。

## Common Factors
- **估值因子**：PE、PB、PS、股息率
- **成长因子**：营收增速、利润增速、ROE提升
- **质量因子**：现金流、负债率、毛利率
- **动量因子**：近20/60/120日收益
- **交易因子**：换手率、量比、资金流
- **风险因子**：波动率、最大回撤、Beta

## A股落地重点
需加入硬过滤：剔除ST、停牌、涨跌停、流动性不足、次新股。

## Connection
- [[main-fund-selection-system]] — 作为四种优先工程化策略和"统一底座"
- [[QuantitativeAnalysis]] — 与量化预评分系统战略一致
- [[AIAgent]] — 可作为AI推荐层的底层框架