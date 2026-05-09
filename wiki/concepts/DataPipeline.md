---
title: "DataPipeline"
type: concept
tags: [data, pipeline, stock-market]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-08
---

# DataPipeline

[[main-fund-selection-system|主力选股系统]]的数据管道从多种来源获取并处理数据。

## 数据源

- [[WencaiAPI|问财API]]（pywencai）：主力资金流向数据，主数据源
- [[Tushare]]：技术指标计算与备选数据源
- 北向资金获取器：北向资金数据
- 龙虎榜关联分析：龙虎榜数据

## 数据处理流程

1. 数据获取（3次重试+指数退避）
2. 数据质量检查（20条/65%完整率门槛）
3. 硬过滤（涨跌幅/市值/ST/科创板/创业板）
4. 技术指标注入（MA/MACD/KDJ/布林带/RSI等）

## Connections

- [[main-fund-selection-system]] — 所属系统
- [[TechnicalAnalysis]] — 技术指标分析