---
title: "DeepSeekClient"
type: entity
tags: [ai, api-client, deepseek]
sources: [ai-intelligent-analysis-system]
last_updated: 2026-05-09
---

## Summary

DeepSeekClient 是[[DeepSeek]] AI 提供商的客户端实现，位于 `app/services/ai/deepseek_client.py`。支持同步+异步双模式（`openai.OpenAI` + `openai.AsyncOpenAI`），底层使用 `httpx.AsyncClient`，`trust_env=False` 避免代理污染，支持 Stale Connection 自动重建和 `reasoning_content`（[[DeepSeekR1]]推理过程）。

## Related

- [[AsyncDeepSeekClient]] — 基于 aiohttp 的纯异步实现
- [[ai-intelligent-analysis-system|AI智能分析系统]] — 所属系统
- [[AIRequestOptimizer]] — 请求治理
- [[AsyncClientPool]] — 连接池管理