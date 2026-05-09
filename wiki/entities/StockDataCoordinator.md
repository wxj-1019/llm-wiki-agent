---
title: "StockDataCoordinator"
type: entity
tags: [ai, data-coordination]
sources: [ai-intelligent-analysis-system]
last_updated: 2026-05-09
---

## Summary

StockDataCoordinator 是数据协调器组件，位于 `app/services/ai/ai_agents_service.py`。统一调度多个数据源服务，提供5种策略依次fallback的价格获取策略链：stock_info→kline_data→candlestick→technical_indicators→latest_indicators。支持技术指标补算：当[[Tushare]]技术指标缺失时，从K线补算RSI/MACD/KDJ/BOLL。

## Related

- [[ai-intelligent-analysis-system|AI智能分析系统]] — 所属系统
- [[TechnicalAnalystAgent]] — 提供技术指标数据
- [[Tushare]] — 数据源之一
- [[DataPipeline]] — 数据管道
- [[Redis]] — 缓存