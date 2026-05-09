---
title: "Backtesting"
type: entity
tags: []
sources: [data-model-overview]
last_updated: 2026-05-09
---

# Backtesting

[[data-model-overview|数据模型总览]] 中定义了完整的回测模块，包含 `main_fund_backtest_summary`（回测日汇总表）和 `main_fund_backtest_detail`（回测个股明细表）。

## 关键能力

- 支持 1/3/5/10 天持有期的胜率和收益率统计
- 分策略统计（strategy_stats JSON）
- 行业分布统计（industry_stats JSON）
- 个股级回测明细（entry_price, return_1d/3d/5d/10d, recommend_count）

相关页面：[[MainFundSelection]]、[[data-model-overview|数据模型总览]]、[[main-fund-selection-system-analysis|主力选股系统整体分析文档]]