---
title: "QuantPreScoring"
type: concept
tags: [quant, scoring, finance]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-07
---

# QuantPreScoring

量化预评分系统（Quant Scorer）是AI分析前的股票客观评分机制。在[[main-fund-selection-system-analysis|主力选股系统]]中，从四个维度进行评分：资金强度（35分）、量价配合（30分）、基本面质量（20分）、估值安全（15分）。评分采用策略自适应权重（不同策略有不同维度配比），并叠加策略专属的多因子公式Overlay层。使用候选池的P10/P90百分位进行全局统计归一化，确保评分跨期可比。量化预评分的主要目的是控制AI候选池大小以节约Token成本。