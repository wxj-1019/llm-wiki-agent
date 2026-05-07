---
title: "StatisticalArbitrage"
type: concept
tags: [quantitative-trading, a-share, arbitrage]
sources: [a-share-quantitative-trading-strategies-guide]
last_updated: 2026-05-07
---

# StatisticalArbitrage

统计套利/配对交易策略寻找两只历史相关性较强的资产，当价差异常扩大时，赌它们未来重新收敛。

## 常见做法
- 同行业龙头之间配对
- ETF 与行业龙头组合
- 指数成分股相对价差交易

## 在 A 股中的限制
A 股股票做空限制较多，股票层面的标准配对交易没有海外市场那么容易落地，很多时候需要借助股指期货、ETF、融资融券。

## 适合谁
- 有较强统计建模能力
- 能处理高频或中频数据
- 有对冲工具可用

## 参见
- [[EventDriven]]
- [[ConvertibleBondArbitrage]]
- [[RiskManagement]]