---
title: "Streaming Analysis"
type: concept
tags: [ai, streaming, websocket, sse]
sources: [ai-intelligent-analysis-system]
last_updated: 2026-05-09
---

## Summary

流式分析（Streaming Analysis）是[[ai-intelligent-analysis-system|AI智能分析系统]]的三种交互模式之一，包括WebSocket实时流式和SSE批量进度推送两种形态。WebSocket流式分析将分析拆解为10个阶段按序推送（INIT→STOCK_INFO→KLINE_DATA→FUNDAMENTAL_DATA→TECHNICAL_DATA→FUND_FLOW_DATA→RISK_DATA→NEWS_DATA→AI_ANALYSIS→FINAL_RESULT），K线数据优先1-2秒内到达。SSE批量分析（最多50只股票）使用 `POST /analyze/batch` 创建任务、`GET /analyze/batch/{task_id}/stream` 实时推送进度、`POST /analyze/batch/{task_id}/cancel` 取消任务，事件类型包括started/progress/stock_completed/completed/failed/heartbeat。

## Related Concepts

- [[ThreeStageAnalysisPipeline]] — 流水线分析
- [[DataPipeline]] — 数据管道
- [[SentimentAnalysis]] — 情感分析