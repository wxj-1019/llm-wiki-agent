---
title: "AsyncClientPool"
type: entity
tags: [ai, connection-pool, async]
sources: [ai-intelligent-analysis-system]
last_updated: 2026-05-09
---

## Summary

AsyncClientPool 是 AI 客户端的连接池管理器，位于 `app/services/ai/ai_client_pool.py`。管理实例生命周期，最大连接数10，空闲超时5分钟，支持连接复用统计和优雅关闭。在[[ai-intelligent-analysis-system|AI智能分析系统]]中用于减少AI提供商连接的建立开销。

## Related

- [[AIRequestOptimizer]] — 请求治理核心
- [[DeepSeekClient]] — 被管理的客户端
- [[AsyncDeepSeekClient]] — 被管理的客户端
- [[Redis]] — 缓存基础设施