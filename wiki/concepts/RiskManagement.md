---
title: "RiskManagement"
type: concept
tags: [finance, risk, system-design]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-07
---

# RiskManagement

[[MainFundSelection|主力选股系统]]的风险管理体系体现在多层防御式筛选和丰富的降级策略上。

## Key Components

- **多层防御式筛选**：每一层都是Fail-Closed设计，失败时返回空而非放行
- **降级策略**：
  - 数据源失败（问财API 3次重试 → 返回失败）
  - 数据质量不达标 → 不生成推荐
  - AI服务不可用 → 按量化+风控规则降级推荐
  - 推荐数量不足 → 量化回填，标记为degraded
- **推荐分层**："优先推荐"（strict）和"谨慎参考"（caution，含4种具体场景）

## Connections

- [[MainFundSelection]] — 应用系统
- [[QuantitativeAnalysis]] — 量化评分作为风险控制手段
- [[Backtesting]] — 回测验证风险模型
- [[AIAgent]] — AI分析中的风险评估