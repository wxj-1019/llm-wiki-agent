---
title: "MomentumStrategy"
type: concept
tags: [quantitative-trading, a-share, momentum]
sources: [a-share-quantitative-trading-strategies-guide]
last_updated: 2026-05-07
---

# MomentumStrategy

动量策略强调"过去一段时间涨得好的，未来一段时间可能继续强"。它与[[TrendTracking|趋势跟踪]]很像，但更偏向截面比较，也就是在同一批股票中找相对最强的。

## 常见信号
- 过去 20 日、60 日、120 日涨幅排名靠前
- 相对沪深 300、中证 1000 的超额收益领先
- 强势股回调后重新放量上行

## A 股特点
A 股有明显的风格外溢和情绪扩散效应，龙头先涨、板块跟涨、强者更强的情况经常发生，因此动量策略在热点市场中经常有效。

## 风险点
- 高波动、高回撤
- 一旦风格切换，强势股补跌很快
- 容易追在情绪尾声

## 参见
- [[TrendTracking]]
- [[MainFundSelectionSystem]]
- [[VolumePriceBreakout]]