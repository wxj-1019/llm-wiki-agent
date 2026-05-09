---
title: "MoneyFlowStrategy"
type: concept
tags: [quantitative-trading, a-share, money-flow]
sources: [a-share-quantitative-trading-strategies-guide, main-fund-selection-system-analysis]
last_updated: 2026-05-07
---

# MoneyFlowStrategy

资金流策略是一种跟踪主力资金流向的量化交易方法。其核心逻辑是：如果主力资金持续净流入，而股价涨幅尚未完全反映，后续可能还有上行动力。

## 常见信号
- 主力净流入连续多日为正
- 单日大额净流入，且占成交额比例较高
- 股价涨幅不大，但量能持续放大
- 大单、超大单资金流明显优于中小单

## A 股适用性
A 股是典型的资金驱动市场，尤其题材启动初期，很多股票会先出现资金异动，再逐渐体现在价格上。因此主力资金、盘口异动、量比等数据非常有参考价值。

## 最佳实践
不要只看"单日净流入金额"，应该关注连续性、占成交额比例、流入时股价所处位置、板块是否同步共振。

## 参见
- [[main-fund-selection-system]]
- [[SectorRotation]]
- [[QuantitativeAnalysis]]