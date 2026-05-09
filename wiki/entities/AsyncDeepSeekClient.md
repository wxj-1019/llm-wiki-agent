---
title: "AsyncDeepSeekClient"
type: entity
tags: [ai, api-client, deepseek, async]
sources: [ai-intelligent-analysis-system]
last_updated: 2026-05-09
---

## Summary

AsyncDeepSeekClient 是[[DeepSeek]] AI 提供商的纯异步客户端实现，位于 `app/services/ai/async_deepseek_client.py`。基于 `aiohttp`，支持异步上下文管理器 (`async with`)，内置 `final_decision()` 和 `comprehensive_discussion_async()` 专用方法。

## Related

- [[DeepSeekClient]] — 同步+异步双模式客户端
- [[ai-intelligent-analysis-system|AI智能分析系统]] — 所属系统
- [[AsyncClientPool]] — 连接池管理