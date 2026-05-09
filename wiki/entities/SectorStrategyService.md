---
title: "SectorStrategyService"
type: entity
tags: [sector-strategy, ai-analysis, snapshot]
sources: [sector-strategy-and-market-analysis]
last_updated: 2026-05-09
---

# SectorStrategyService

板块策略核心服务，位于 `app/services/sector/strategy_service.py`，是[[板块策略与大盘分析]]模块的策略引擎。

## 功能
- `refresh_all_market_data()` — 定时任务刷新全量市场数据并生成快照
- `get_category_overview(category, period)` — 读库模式获取大类概览（行业/概念）
- `get_stock_chart(stock_code, period)` — 个股K线（优先缓存，降级主动获取）
- `analyze_sector()` — AI综合分析（调用[[SectorAgentsService]]）
- `sync_sector_history()` — 同步板块历史数据

## 设计特点
- 5分钟快照有效期，支持多周期（1m/3m/1y/5y/all）
- 优先读`SystemSnapshot`→`MarketMapPublished`→轻量级fallback

## Connections
- [[AIMultiAgentStockAnalysis]] — AI板块分析采用多智能体模式
- [[APScheduler]] — 定时任务驱动全量数据刷新
- [[DataPipeline]] — 快照机制是数据管道的缓存层