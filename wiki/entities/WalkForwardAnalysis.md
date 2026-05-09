---
title: "WalkForwardAnalysis"
type: entity
tags: [backtest, validation, overfitting]
sources: [backtest-engine]
last_updated: 2026-05-09
---

[[WalkForwardAnalysis|Walk-Forward 分析]] 是一种防止回测过拟合的方法，通过滚动时间窗口（训练/测试/步长默认 252/63/63 天）验证策略在不同市场环境下的稳定性。在 [[backtest-engine|回测引擎]] 中作为高级分析功能提供。
