---
title: "TushareClient"
type: entity
tags: [data-source, tushare, client, singleton]
sources: [stock-data-service]
last_updated: 2026-05-09
---

# TushareClient

TushareClient 是 [[Tushare]] Pro API 的单例封装，位于 `app/services/stock_data/datasources/tushare/client.py`。支持异步查询、Redis 缓存和速率限制（约200次/分钟），自动代码转换（`000001` → `000001.SZ/SH`），并在检测到连接级错误时自动重建 `httpx` 客户端。支持自定义 Tushare URL 环境变量。

## Connected Pages
- [[Tushare]]
- [[TusharePro]]
- [[统一数据源管理器]]
- [[股票数据服务]]