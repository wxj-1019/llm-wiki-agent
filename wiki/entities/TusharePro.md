---
title: "TusharePro"
type: entity
tags: [data-source, finance, stock-data]
sources: [stock-data-service]
last_updated: 2026-05-09
---

# TusharePro

Tushare Pro 是 [[Tushare]] 的付费版数据服务，提供更高频、更稳定的股票数据接口。在[[股票数据服务]]中，Tushare Pro 被配置为**主数据源**（最高优先级），封装于 `TushareClient` 单例中，支持异步查询、Redis 缓存和速率限制（约200次/分钟）。其实时行情降级链包括 `rt_k`（付费批量）、`a_stock_daily_realtime`（付费实时）和 `daily`（通用T-1）。

## Connected Pages
- [[股票数据服务]]
- [[Tushare]]
- [[MainFundSelection]]
- [[Backtesting]]