---
title: "RiskManagement"
type: concept
tags: [risk, control, stock-selection]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-08
---

# RiskManagement

[[main-fund-selection-system|主力选股系统]]的风险管理体系体现在多层防御式筛选和丰富的降级策略上。

## 多层防御式筛选

每一层都是Fail-Closed（失败时返回空而非放行）：
1. 数据质量检查
2. 硬过滤（涨跌幅/市值/ST）
3. 策略硬过滤（净流入/换手率）
4. 财务Guardrails（PE/PB/ROE/负债率）
5. 技术指标筛选
6. 量化预评分排序
7. AI五维分析
8. 策略适配检查
9. 资深研究员综合

## 降级策略

- AI不可用时：按量化+风控规则降级
- 推荐数量不足时：量化回填
- 数据获取失败：返回空

## Connections

- [[main-fund-selection-system]] — 所属系统
- [[Backtesting]] — 回测验证
- [[QuantPreScoring]] — 量化预评分