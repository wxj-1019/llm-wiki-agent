---
title: "MainForceAccumulation — 主力吸筹策略"
type: entity
tags: [strategy, stock-selection, quantitative]
sources: [main-fund-selection-system]
last_updated: 2026-05-09
---

**主力吸筹策略**是[[MainFundSelection|主力选股系统]]内置的7种策略之一，ID为 `main_force_accumulation`。核心特征是资金大幅流入但涨幅较小，具备建仓特征。

## 策略特点

- **量化权重偏向**: 资金强度35% + 量价配合30%
- **关键信号**: 资金大涨幅小，主力建仓迹象
- **应用场景**: 发现被低估的主力建仓标的

## Connections

- [[MainFundSelection]] — 所属系统
- [[ShortTermBreakout]] — 对比策略（短期爆发）
- [[ValueStable]] — 对比策略（价值稳健）
- [[QuantPreScoring]] — 量化评分支持
