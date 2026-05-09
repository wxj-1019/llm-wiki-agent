---
title: "StockKlineCacheService"
type: entity
tags: [kline, cache, database]
sources: [sector-strategy-and-market-analysis]
last_updated: 2026-05-09
---

# StockKlineCacheService

K线缓存服务，位于 `app/services/sector/stock_kline_cache_service.py`，为[[板块策略与大盘分析]]模块提供个股K线数据的缓存与降级获取。

## 功能
- 优先读`StockKlineCache`表（24h TTL）
- 未命中则调用[[SectorDataProvider]]的`get_stock_chart_async()`（Tushare daily）
- 独立DB session避免并发冲突
- 批量刷新按股票维度原子化（同一股票的4个周期一起刷）
- 静默模式：刷新失败不抛异常

## Connections
- [[A股市场]] — K线数据面向A股个股
- [[Redis]] — 前端缓存层（与本服务的DB缓存形成双层缓存）