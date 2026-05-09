---
title: "MultiFactorSelection"
type: concept
tags: [quantitative-trading, a-share, scoring-system]
sources: [a-share-quantitative-trading-strategies-guide, main-fund-selection-system-analysis]
last_updated: 2026-05-07
---

# MultiFactorSelection

多因子选股策略是一种同时从估值、成长、质量、动量、波动率、资金流等多个维度给股票打分，再综合排序选股的量化方法。它不押注单一逻辑，而是通过多因子的综合评分实现更稳健的选择。

## 常见因子
- **估值因子**：PE、PB、PS、股息率
- **成长因子**：营收增速、利润增速、ROE 提升
- **质量因子**：现金流、负债率、毛利率
- **动量因子**：近 20/60/120 日收益
- **交易因子**：换手率、量比、资金流
- **风险因子**：波动率、最大回撤、Beta

## A 股落地重点
在 A 股，多因子策略通常要加入硬过滤：剔除 ST、剔除停牌、剔除涨跌停、剔除流动性不足、剔除上市时间过短的次新股。

## 与系统关联
本系统[[main-fund-selection-system|主力选股系统]]的量化预评分系统（Quant Scorer）与多因子评分理念一致，从资金强度、量价配合、基本面、估值安全四个维度综合评分，并可叠加策略专属公式 Overlay。

## 优缺点
- 优点：更稳健、易于扩展和工程化，适合作为平台型选股框架
- 缺点：因子过多容易过拟合、因子之间可能互相冲突、需要持续做因子有效性检验

## 参见
- [[QuantitativeAnalysis]]
- [[main-fund-selection-system]]
- [[AIAgent]]