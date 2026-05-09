---
title: "ControlledPullback — 温和回调多头策略"
type: entity
tags: [strategy, stock-selection, quantitative]
sources: [main-fund-selection-system]
last_updated: 2026-05-09
---

**温和回调多头策略**是[[MainFundSelection|主力选股系统]]内置的7种策略之一，ID为 `controlled_pullback`。核心特征是回调-1%~-3%，均线多头排列。

## 策略特点

- **量化权重偏向**: 量价配合35% + 资金强度30%
- **关键信号**: 小幅回调但趋势未改
- **应用场景**: 趋势中的回调买入机会

## Connections

- [[MainFundSelection]] — 所属系统
- [[ShortTermBreakout]] — 对比策略
- [[TechnicalAnalysis]] — 技术形态支撑
