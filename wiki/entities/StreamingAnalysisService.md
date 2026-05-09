---
title: "StreamingAnalysisService"
type: entity
tags: [ai, streaming, websocket]
sources: [ai-intelligent-analysis-system]
last_updated: 2026-05-09
---

## Summary

StreamingAnalysisService 是流式分析服务，位于 `app/services/ai/streaming_analysis_service.py`。将分析拆解为10个阶段按序推送：INIT→STOCK_INFO→KLINE_DATA→FUNDAMENTAL_DATA→TECHNICAL_DATA→FUND_FLOW_DATA→RISK_DATA→NEWS_DATA→AI_ANALYSIS→FINAL_RESULT。关键设计：K线数据优先推送（1-2秒内到达），数据并行获取（`asyncio.gather`），AI分析阶段模拟25%→50%→75%→100%进度推送。

## Related

- [[ConnectionManager]] — WebSocket连接管理
- [[ai-intelligent-analysis-system|AI智能分析系统]] — 所属系统
- [[TechnicalAnalystAgent]] — 分析智能体
- [[FundamentalAnalystAgent]] — 分析智能体