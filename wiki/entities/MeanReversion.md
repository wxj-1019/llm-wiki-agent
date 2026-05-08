---
title: "MeanReversion"
type: entity
tags: [strategy, mean-reversion, contrarian]
sources: [a-share-quantitative-trading-strategies-guide]
last_updated: 2026-05-08
---

均值回归策略（Mean Reversion）认为价格短期偏离合理区间后，未来有较大概率向均值回归。常见做法是买超跌、卖超涨。

## Common Signals
- RSI低于20或30
- 股价远离布林带下轨后出现缩量企稳
- 短期跌幅过大，但基本面未明显恶化

## A股实战提醒
必须加"基本面未坏"和"没有重大利空"过滤，否则容易把趋势性下跌误判为超跌机会。

## Connection
- [[VolumePriceBreakout]] — 对立逻辑但可互补
- [[ValueStrategy]] — 基本面过滤关联