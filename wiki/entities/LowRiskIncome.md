---
title: "LowRiskIncome — 低风险收益策略"
type: entity
tags: [strategy, stock-selection, quantitative]
sources: [main-fund-selection-system]
last_updated: 2026-05-09
---

**低风险收益策略**是[[MainFundSelection|主力选股系统]]内置的7种策略之一，ID为 `low_risk_income`。核心特征是低波动、低估值。

## 策略特点

- **量化权重偏向**: 估值安全45% + 基本面35%
- **关键信号**: 低波动、安全边际高
- **应用场景**: 追求稳健收益的防御型配置

## Connections

- [[MainFundSelection]] — 所属系统
- [[ValueStable]] — 对比策略
- [[HighDividendLowVol]] — 相似概念
