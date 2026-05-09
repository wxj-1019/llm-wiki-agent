---
title: "股票数据服务"
type: source
tags: [stock-data, market-index, sector, datasource, tushare, akshare]
date: 2026-05-09
source_file: raw/uploads/02_股票数据服务.md
---

## Summary

股票数据服务是平台的**数据底座**，负责从多数据源获取、整合、缓存和分发股票相关的全量数据。系统采用统一数据源管理器作为门面，内置智能优先级调度、自动降级、健康检查和多层缓存机制。核心数据源为 [[Tushare]] Pro（主），备用链路包括 [[AKShare]]、新浪、东方财富、同花顺、问财等。该服务还涵盖[[大盘指数服务]]、[[大盘云图]]和[[板块策略数据服务]]，支撑[[MainFundSelection|主力选股系统]]、[[Backtesting|回测引擎]]等上层业务的数据需求。

## Key Claims

- **统一数据源管理器**：支持智能市场识别（A股/港股/美股）、动态优先级、自动降级、指数退避重试、健康检查和统计计数
- **Tushare TushareClient**：单例封装，异步查询 + Redis 缓存 + 速率限制（约200次/分钟），自动代码转换（`000001` → `000001.SZ/SH`）
- **实时行情三级降级链**：`rt_k`（付费） → `a_stock_daily_realtime`（付费） → `daily`（通用日线T-1）
- **大盘指数服务**：数据库缓存模式，后台每分钟刷新入库（仅交易时间9:30-11:30,13:00-15:00），8只主要指数，前端<50ms响应
- **大盘云图**：双表机制（`MarketMapRaw` + `MarketMapPublished`），版本回滚支持，5分钟涨跌刷新 + 每日15:05完整刷新
- **板块策略数据服务**：7种数据类型各有主/备数据源，全局并发限制 `asyncio.Semaphore(3)`，K线缓存24h TTL
- **分层降级策略**：几乎每条链路2-4级降级，记录失败源避免反复尝试
- **缓存多层化**：Redis（<1ms）→ PostgreSQL 快照（<50ms）→ 外部 API（秒级）

## Key Quotes

> "股票数据服务是平台的**数据底座**，负责从多数据源获取、整合、缓存和分发股票相关的全量数据。"

> "实时行情三级降级链：rt_k（付费，最稳定） → a_stock_daily_realtime（付费） → daily（通用日线，T-1数据）"

> "大盘云图使用 Raw + Published 双表，支持版本回滚和数据溯源"

## Connections

- [[Tushare]] — 系统主数据源，Tushare Pro 客户端封装
- [[AKShare]] — 备用数据源之一，用于新浪/东方财富/同花顺数据
- [[MainFundSelection|主力选股系统]] — 数据底座为核心选股系统提供全量数据
- [[Backtesting|回测引擎]] — 回测需要历史K线数据，通过该服务获取
- [[DataPipeline|数据管道]] — 统一数据源管理器是数据管道的核心
- [[大盘指数服务]] — A股8只主要指数的实时数据服务
- [[大盘云图]] — Treemap 涨跌云图可视化
- [[板块策略数据服务]] — 行业/概念行情、资金流向、北向资金等
- [[市场识别]] — 智能区分A股/港股/美股市场
- [[价格监控与预警系统]] — 实时行情数据源供预警系统使用
- [[Redis]] — 缓存层核心组件
- [[PostgreSQL]] — 持久化存储
- [[AKShare]] — 备用源
- [[TusharePro]] — 付费数据源
- [[统一数据源管理器]] — 数据获取门面
- [[AutoTitleConvert]] — 自动代码转换功能
- [[TradeCalendar]] — 交易日历集成

## Contradictions

None detected.
