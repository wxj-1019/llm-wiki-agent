---
title: "WencaiAPI — 问财API"
type: entity
tags: [data-source, a-share, stock-data]
sources: [main-fund-selection-system]
last_updated: 2026-05-09
---

**问财API（pywencai）**是[[MainFundSelection|主力选股系统]]的主要数据源，提供A股市场的主力资金流向数据。

## 用途

- 主力选股系统的第一优先级数据源
- 获取全市场主力资金流入股票的原始数据
- 带3次重试+指数退避超时机制

## Connections

- [[MainFundSelection]] — 主力数据源
- [[Tushare]] — 备用降级数据源
- [[DataPipeline]] — 数据获取层
