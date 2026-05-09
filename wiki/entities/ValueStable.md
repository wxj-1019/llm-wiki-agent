---
title: "ValueStable — 价值稳健策略"
type: entity
tags: [strategy, stock-selection, quantitative]
sources: [main-fund-selection-system]
last_updated: 2026-05-09
---

**价值稳健策略**是[[MainFundSelection|主力选股系统]]内置的7种策略之一，ID为 `value_stable`。核心特征是低PE/PB、高ROE。

## 策略特点

- **量化权重偏向**: 基本面40% + 估值安全35%
- **关键信号**: 低估值、高盈利质量
- **应用场景**: 寻找低估值的优质公司

## Connections

- [[MainFundSelection]] — 所属系统
- [[GrowthPotential]] — 对比策略（成长潜力）
- [[LowRiskIncome]] — 对比策略（低风险收益）
