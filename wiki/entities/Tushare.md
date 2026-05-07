---
title: "Tushare"
type: entity
tags: [financial-data, api, china-stock]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-07
---

# Tushare

Tushare是[[MainFundSelection|主力选股系统]]的备选数据源和技术指标提供者。

## Key Facts

- 提供主力资金数据（作为问财API的备用降级）
- 负责技术指标计算与注入：MA5/MA20/MA60、MACD、KDJ、布林带、RSI、量比、波动率
- 为AI分析师中的技术形态分析师提供数据基础

## Connections

- [[MainFundSelection]] — 主力选股系统的备选数据源
- [[WencaiAPI]] — 主数据源
- [[DataPipeline]] — 构成系统数据获取层