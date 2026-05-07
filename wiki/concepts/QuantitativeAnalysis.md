---
title: "QuantitativeAnalysis"
type: concept
tags: [finance, quant, scoring]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-07
---

# QuantitativeAnalysis

量化分析在[[MainFundSelection|主力选股系统]]中通过量化预评分系统（Quant Scorer）实现，在AI分析前对股票进行客观评分。

## Key Components

- **四维度评分**：资金强度（35分）、量价配合（30分）、基本面（20分）、估值安全（15分）
- **策略自适应权重**：7种策略各有不同的维度权重配置
- **公式Overlay**：每个策略有专属多因子公式输出0-100分，以50分为基准blend
- **全局统计归一化**：使用P10/P90百分位确保跨期可比

## Connections

- [[MainFundSelection]] — 应用系统
- [[RiskManagement]] — 评分系统的风控集成
- [[Backtesting]] — 回测验证量化信号
- [[AIAgent]] — AI分析师使用量化评分作为输入之一