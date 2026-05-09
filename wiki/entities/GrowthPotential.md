---
title: "GrowthPotential — 成长潜力策略"
type: entity
tags: [strategy, stock-selection, quantitative]
sources: [main-fund-selection-system]
last_updated: 2026-05-09
---

**成长潜力策略**是[[MainFundSelection|主力选股系统]]内置的7种策略之一，ID为 `growth_potential`。核心特征是高成长评分，容忍较高PE。

## 策略特点

- **量化权重偏向**: 基本面45% + 资金强度25%
- **关键信号**: 高成长性
- **应用场景**: 寻找具有持续增长潜力的成长股

## Connections

- [[MainFundSelection]] — 所属系统
- [[ValueStable]] — 对比策略（价值稳健）
- [[SectorRotation]] — 对比策略（板块轮动）
