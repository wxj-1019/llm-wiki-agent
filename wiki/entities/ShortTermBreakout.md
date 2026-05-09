---
title: "ShortTermBreakout — 短期爆发策略"
type: entity
tags: [strategy, stock-selection, quantitative]
sources: [main-fund-selection-system]
last_updated: 2026-05-09
---

**短期爆发策略**是[[MainFundSelection|主力选股系统]]内置的7种策略之一，ID为 `short_term_breakout`。核心特征是突破形态，涨幅5-30%。

## 策略特点

- **量化权重偏向**: 量价配合35% + 资金强度30%
- **关键信号**: 突破形态，涨幅适中
- **应用场景**: 捕捉短线启动的强势个股

## Connections

- [[MainFundSelection]] — 所属系统
- [[MainForceAccumulation]] — 对比策略（主力吸筹）
- [[ControlledPullback]] — 对比策略（温和回调多头）
