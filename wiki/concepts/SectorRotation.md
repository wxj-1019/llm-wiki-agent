---
title: "SectorRotation"
type: concept
tags: [quantitative-trading, a-share, sector-analysis]
sources: [a-share-quantitative-trading-strategies-guide, main-fund-selection-system-analysis]
last_updated: 2026-05-07
---

# SectorRotation

板块轮动策略是一种先判断当前市场最强行业或主题，再从强板块中挑选最强个股的量化方法。核心是"先选赛道，再选个股"。

## 常见信号
- 板块涨幅排名靠前
- 板块成交额放大
- 板块净流入持续增强
- 板块内涨停家数增加
- 龙头股持续创新高

## A 股中为什么很常见
A 股历来有明显的板块轮动特征，比如新能源、算力、半导体、军工、低空经济、机器人等，经常呈现"板块先强，个股扩散"的结构。

## 优缺点
- 优点：更符合 A 股的主题投资特征，能减少"选到逆板块个股"的概率
- 缺点：轮动太快时容易追涨杀跌，板块定义和成分更新需要维护

## 系统集成
本系统[[main-fund-selection-system|主力选股系统]]已内置"板块轮动"策略，与[[MoneyFlowStrategy|资金流]]、[[TrendTracking|趋势]]等策略可叠加使用。

## 参见
- [[main-fund-selection-system]]
- [[MoneyFlowStrategy]]
- [[AIAgent]]