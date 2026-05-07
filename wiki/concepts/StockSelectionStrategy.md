---
title: "StockSelectionStrategy"
type: concept
tags: [strategy, finance, stock-selection]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-07
---

# StockSelectionStrategy

AI驱动的股票选择策略框架。在[[main-fund-selection-system-analysis|主力选股系统]]中，选股策略定义了从数据过滤到量化评分再到AI分析的完整规则。每种策略拥有独立的四层配置：硬过滤条件、财务Guardrails、策略适配基线、量化评分权重。系统内置7种策略：[[MainForceAccumulation|主力吸筹]]、[[ShortTermBreakout|短期爆发]]、[[ValueStable|价值稳健]]、[[GrowthPotential|成长潜力]]、[[SectorRotation|板块轮动]]、[[LowRiskIncome|低风险收益]]、[[ControlledPullback|温和回调多头]]。策略配置支持版本化管理，可在数据库中进行热切换。