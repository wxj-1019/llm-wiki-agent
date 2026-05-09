---
title: "MAStrategy"
type: entity
tags: [strategy, moving-average, backtest]
sources: [backtest-engine]
last_updated: 2026-05-09
---

[[MAStrategy|均线策略]] 是 [[backtest-engine|回测引擎]] 内置策略之一，基于短期均线上穿长期均线买入/下穿卖出的逻辑，本质是 [[TrendTracking|趋势跟踪]] 的量化实现。
