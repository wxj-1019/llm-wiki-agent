---
title: "StatisticalArbitrage"
type: entity
tags: [strategy, stat-arb, pairs-trading]
sources: [a-share-quantitative-trading-strategies-guide]
last_updated: 2026-05-08
---

统计套利/配对交易策略（Statistical Arbitrage）寻找两只历史相关性较强的资产，当价差异常扩大时，赌它们未来重新收敛。

## Common Approaches
- 同行业龙头之间配对
- ETF与行业龙头组合
- 指数成分股相对价差交易

## A股限制
A股做空限制较多，标准配对交易需借助股指期货、ETF、融资融券。

## Connection
- [[MoneyFlowStrategy]] — 资金流可用于确认价差背离
- [[QuantitativeAnalysis]] — 依赖统计建模能力