---
title: "MainFundSelection"
type: entity
tags: []
sources: [data-model-overview]
last_updated: 2026-05-09
---

# MainFundSelection

[[MainFundSelectionDataModel|数据模型]]中的主力选股系统对应 `stock_analysis` Schema 下的 `main_fund_selections` 和 `main_fund_selected_stocks` 两张核心表。

## 关键数据结构

- `main_fund_selections`: 存储每次选股记录，包含筛选参数、策略配置、结果统计、Token 消耗、AI 分析结果（资金流分析、行业分析、基本面分析、技术形态分析、资深研究员推荐）
- `main_fund_selected_stocks`: 存储推荐股票明细，含资金面、基本面、财务评分、AI 推荐理由、交易区间、量化评分、深度学习分析结果、数据快照

相关页面：[[MainFundSelection]]、[[data-model-overview|数据模型总览]]、[[main-fund-selection-system-analysis|主力选股系统整体分析文档]]