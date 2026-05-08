---
title: "QuantPreScoring"
type: concept
tags: [quantitative-analysis, scoring, stock-selection]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-08
---

# QuantPreScoring

量化预评分系统（Quant Scorer）是AI分析前的股票客观评分机制。在[[MainFundSelectionSystem|主力选股系统]]中，它从资金强度35分、量价配合30分、基本面20分、估值安全15分四个维度综合评分，并叠加策略专属公式Overlay。

## 评分维度

- **资金强度**（35分）：相对净流入强度 = 净流入/市值
- **量价配合**（30分）：策略差异化评分
- **基本面质量**（20分）：8项财务评分加权
- **估值安全**（15分）：PE/PB分段打分

## 策略自适应权重

七种策略各有不同的四维度权重配置，例如价值策略偏向基本面(40%)和估值(35%)，主力吸筹策略偏向资金(35%)和量价(30%)。

## Connections

- [[MainFundSelectionSystem]] — 所属系统
- [[QuantitativeAnalysis]] — 量化分析方法论
- [[Backtesting]] — 回测验证结果