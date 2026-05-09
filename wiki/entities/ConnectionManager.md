---
title: "ConnectionManager"
type: entity
tags: [websocket, connection-management]
sources: [ai-intelligent-analysis-system]
last_updated: 2026-05-09
---

## Summary

ConnectionManager 是 WebSocket 连接管理器，位于 `app/api/v1/stock/websocket_analysis.py`。管理活跃 WebSocket 连接（`Dict[str, WebSocket]`），支持 `start_analysis` / `ping` 两种客户端消息。在[[ai-intelligent-analysis-system|AI智能分析系统]]中用于流式分析连接的跟踪。

## Related

- [[ai-intelligent-analysis-system|AI智能分析系统]] — 所属系统
- [[StreamingAnalysisService]] — 流式分析服务