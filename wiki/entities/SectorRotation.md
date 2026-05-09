---
title: "SectorRotation — 板块轮动策略"
type: entity
tags: [strategy, stock-selection, quantitative]
sources: [main-fund-selection-system]
last_updated: 2026-05-09
---

**板块轮动策略**是[[MainFundSelection|主力选股系统]]内置的7种策略之一，ID为 `sector_rotation`。核心特征是板块热度+龙头效应。

## 策略特点

- **量化权重偏向**: 资金强度45% + 量价配合30%
- **关键信号**: 强势板块中的领涨个股
- **应用场景**: 板块轮动行情中的龙头股捕捉

## Connections

- [[MainFundSelection]] — 所属系统
- [[MainForceAccumulation]] — 对比策略
- [[sector-strategy-and-market-analysis|板块策略与大盘分析]] — 板块数据支撑
