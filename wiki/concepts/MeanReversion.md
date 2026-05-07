---
title: "MeanReversion"
type: concept
tags: [quantitative-trading, a-share, reversal]
sources: [a-share-quantitative-trading-strategies-guide]
last_updated: 2026-05-07
---

# MeanReversion

均值回归策略认为，价格短期偏离合理区间后，未来有较大概率向均值回归。常见做法是买超跌、卖超涨。

## 常见信号
- RSI 低于 20 或 30
- 股价远离布林带下轨后出现缩量企稳
- 短期跌幅过大，但基本面未明显恶化

## A 股适用性
A 股短期情绪化较强，容易出现"错杀"和"超跌反弹"，尤其是题材股退潮后的技术性修复、业绩稳定白马股的短期过度回调。

## 实战提醒
一定要加"基本面未坏"和"没有重大利空"的过滤，否则容易把趋势性下跌误判为超跌机会。

## 参见
- [[TrendTracking]]
- [[RiskManagement]]
- [[TechnicalAnalysis]]