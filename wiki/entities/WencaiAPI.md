---
title: "WencaiAPI"
type: entity
tags: [financial-data, api, china-stock]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-07
---

# WencaiAPI

问财API（pywencai）是[[MainFundSelection|主力选股系统]]的主要数据源，提供A股市场的主力资金流向数据。

## Key Facts

- 通过pywencai Python库接入
- 提供主力资金净流入、大单占比等核心数据
- 系统中作为主数据源，[[Tushare]]作为备选降级方案
- 获取失败时有3次重试 + 指数退避超时机制

## Connections

- [[MainFundSelection]] — 主力选股系统的核心数据来源
- [[Tushare]] — 备选降级数据源
- [[DataPipeline]] — 构成系统数据获取层