---
title: "Backtesting"
type: entity
tags: [backtest, finance, stock-selection]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-07
---

# Backtesting

回测验证系统是[[main-fund-selection-system-analysis|主力选股系统]]的重要组成部分，用于验证选股策略和AI推荐的有效性。使用T+1开盘价作为买入价，支持1/3/5/10日持有期，双边总成本模型为0.23%（含滑点、市场冲击、佣金和印花税）。输出指标包括胜率、平均收益率、最大/最小收益等，支持按策略版本对比分析。