---
title: "MoneyFlowStrategy"
type: entity
tags: [strategy, money-flow, quantitative-trading]
sources: [a-share-quantitative-trading-strategies-guide]
last_updated: 2026-05-08
---

主力资金流入策略（Money Flow Strategy）是一种跟踪大资金流向的量化交易方法。其核心逻辑是：如果主力资金持续净流入，而股价涨幅尚未完全反映，后续可能还有上行动力。

## Key Signals
- 主力净流入连续多日为正
- 单日大额净流入，且占成交额比例较高
- 股价涨幅不大，但量能持续放大
- 大单、超大单资金流明显优于中小单

## A股适用性
A股是典型的资金驱动市场。题材启动初期，很多股票会先出现资金异动，再逐渐体现在价格上。

## Best Practices
- 不应只看"单日净流入金额"，应综合关注连续性、占成交额比例、股价位置、板块共振
- 可与[[TrendTracking]]和[[SectorRotation]]结合使用

## Connection
- [[MainFundSelectionSystem]] — 作为四种优先工程化策略之一
- [[WencaiAPI]] — 数据来源
- [[Tushare]] — 数据来源