---
title: "Backtesting"
type: concept
tags: [finance, backtesting, validation]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-07
---

# Backtesting

回测验证是[[MainFundSelection|主力选股系统]]六层架构的最后一环，用于验证推荐质量。

## Key Facts

- **买入规则**：T+1开盘价买入（散户实际可执行价格）
- **持有周期**：1日 / 3日 / 5日 / 10日
- **成本模型**：双边总成本约0.23%（含滑点、市场冲击、佣金、印花税）
- **输出指标**：胜率、平均收益率、最大/最小收益、策略统计、行业分布
- **版本化支持**：不同策略版本参数可独立回测对比

## Connections

- [[MainFundSelection]] — 应用系统
- [[QuantitativeAnalysis]] — 回测评估量化策略效果
- [[RiskManagement]] — 回测结果用于风险评估