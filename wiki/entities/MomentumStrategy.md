---
title: "MomentumStrategy"
type: entity
tags: [strategy, momentum, cross-section]
sources: [a-share-quantitative-trading-strategies-guide]
last_updated: 2026-05-08
---

动量策略（Momentum Strategy）强调"过去一段时间涨得好的，未来一段时间可能继续强"。它和[[TrendTracking]]很像，但更偏向截面比较，在同一批股票中找相对最强的。

## Common Signals
- 过去20日、60日、120日涨幅排名靠前
- 相对沪深300、中证1000的超额收益领先
- 强势股回调后重新放量上行

## A股特点
A股有明显风格外溢和情绪扩散效应，龙头先涨、板块跟涨的情况经常发生，因此动量策略在热点市场中经常有效。

## Connection
- [[TrendTracking]] — 战略关联
- [[SectorRotation]] — 可结合板块识别
- [[TrendMomentum]] — 可与趋势组合使用