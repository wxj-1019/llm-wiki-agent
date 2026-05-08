---
title: "TrendMomentum"
type: entity
tags: [strategy, trend, momentum, composite]
sources: [a-share-quantitative-trading-strategies-guide]
last_updated: 2026-05-08
---

趋势+动量复合策略（Trend + Momentum Composite）是将[[TrendTracking]]和[[MomentumStrategy]]结合的策略。趋势提供方向判断（均线排列、MACD金叉等），动量提供相对强度筛选（截面排名筛选）。

## Why Combine
- 趋势跟踪解决"方向"问题
- 动量解决"哪个更强"的问题
- 二者结合可以减少只看资金流被假信号干扰的问题
- 信号稳定，回测相对容易

## A股适用性
特别适合A股的板块轮动和热点扩散特征，能较好捕捉主线板块中的强势股。

## Connection
- [[MainFundSelectionSystem]] — 作为四种优先工程化策略之一
- [[SectorRotation]] — 可与板块轮动叠加使用
- [[MoneyFlowStrategy]] — 可与资金流策略组合