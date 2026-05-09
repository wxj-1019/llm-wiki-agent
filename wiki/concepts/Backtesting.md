---
title: "Backtesting"
type: concept
tags: [backtest, validation, stock-selection]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-08
---

# Backtesting

回测验证是[[main-fund-selection-system|主力选股系统]]六层架构的最后一环，用于验证推荐质量。

## 回测引擎核心设计

- **买入规则**：T+1开盘价买入（散户实际可执行价格）
- **持有周期**：1日/3日/5日/10日
- **成本模型**：双边总成本约0.23%（滑点10bp+冲击5bp+佣金3bp+印花税5bp）

## 输出指标

- win_rate_{N}d：N日持有期胜率
- avg_return_{N}d：N日平均收益率
- strategy_stats：分策略统计
- industry_stats：行业分布统计

## Connections

- [[main-fund-selection-system]] — 所属系统
- [[RiskManagement]] — 风控验证
- [[QuantitativeAnalysis]] — 量化分析