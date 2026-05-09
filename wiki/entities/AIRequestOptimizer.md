---
title: "AIRequestOptimizer"
type: entity
tags: [ai, request-optimization, concurrency]
sources: [ai-intelligent-analysis-system]
last_updated: 2026-05-09
---

## Summary

AIRequestOptimizer 是 AI 调用治理的核心组件，位于 `app/services/ai/ai_request_optimizer.py`。提供五层防护：并发控制（`asyncio.Semaphore(max_concurrent=5)`）、请求重试（最大3次指数退避）、超时控制（60s）、熔断器（5次失败→180s冷却→半开状态）、连接池复用（[[AsyncClientPool]]）。内置详细的阶段耗时追踪（semaphore_wait/client_wait/api_elapsed），超过10s的慢请求自动记录。

## Related

- [[ai-intelligent-analysis-system|AI智能分析系统]] — 所属系统
- [[AsyncClientPool]] — 连接池管理
- [[Redis]] — 缓存支持
- [[RateLimiting]] — 类似治理模式