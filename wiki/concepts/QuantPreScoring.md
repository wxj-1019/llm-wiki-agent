---
title: "QuantPreScoring — 量化预评分"
type: concept
tags: [stock-selection, quantitative, scoring]
sources: [main-fund-selection-system]
last_updated: 2026-05-09
---

**量化预评分**（Quant Scorer）是[[MainFundSelection|主力选股系统]]中AI分析前的股票客观评分机制。评分采用四大维度设计：资金强度（35分）、量价配合（30分）、基本面质量（20分）、估值安全（15分），总分100分。

## 核心机制

- **策略自适应权重**：7种策略各有不同权重配置
- **公式Overlay层**：每个策略有专属多因子公式（7-8个因子加权），平移调整量化总分
- **全局统计归一化**：使用候选池的P10/P90百分位进行归一化
- **排名截断**：按量化分排序，截取Top N进入AI分析，控制AI成本

## Connections

- [[MainFundSelection]] — 所属系统
- [[QuantitativeAnalysis]] — 量化分析方法论
- [[MainForceAccumulation]] — 策略特定权重
- [[ShortTermBreakout]] — 策略特定权重
