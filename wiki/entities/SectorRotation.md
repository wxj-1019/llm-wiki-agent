---
title: "SectorRotation"
type: entity
tags: [strategy, sector, rotation]
sources: [a-share-quantitative-trading-strategies-guide]
last_updated: 2026-05-08
---

板块轮动策略（Sector Rotation）是先判断当前市场最强行业或主题，再从强板块中挑选最强个股的量化方法。核心是"先选赛道，再选个股"。

## Common Signals
- 板块涨幅排名靠前
- 板块成交额放大
- 板块净流入持续增强
- 板块内涨停家数增加
- 龙头股持续创新高

## A股适用性
A股历来有明显的板块轮动特征，如新能源、算力、半导体、军工等，经常呈现"板块先强，个股扩散"的结构。

## Connection
- [[MainFundSelectionSystem]] — 作为四种优先工程化策略之一
- [[MoneyFlowStrategy]] — 可与资金流结合
- [[TrendMomentum]] — 可与趋势动量结合