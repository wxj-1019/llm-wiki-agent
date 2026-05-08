---
title: "TrendTracking"
type: entity
tags: [strategy, trend, technical-analysis]
sources: [a-share-quantitative-trading-strategies-guide]
last_updated: 2026-05-08
---

趋势跟踪策略（Trend Tracking）是一种跟随上涨趋势的量化交易策略。其本质是：股价一旦形成上升趋势，往往不会立刻结束，而是会沿着趋势持续一段时间。策略不去预测底部，而是在趋势已经明确后跟随。

## Common Signals
- 5日均线 > 20日均线 > 60日均线
- 股价站上60日或120日均线
- MACD金叉且位于零轴上方
- 创阶段新高

## A股适用性
A股一旦出现主线板块，龙头和核心趋势股经常有明显"沿均线上行"特征，尤其在机构抱团和行业景气上行阶段。

## Connection
- [[MomentumStrategy]] — 战略关联
- [[MainFundSelectionSystem]] — 与系统中"温和回调多头"策略相关
- [[TrendMomentum]] — 可与动量组合使用