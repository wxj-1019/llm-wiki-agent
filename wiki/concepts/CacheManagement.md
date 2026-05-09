---
title: "CacheManagement"
type: concept
tags: [infrastructure, performance]
sources: [task-scheduler-and-infrastructure]
last_updated: 2026-05-09
---

# CacheManagement

缓存管理是平台性能优化的关键策略。[[task-scheduler-and-infrastructure|任务调度与基础设施]]模块中的 `RedisCacheManager` 提供连接池管理、JSON 序列化/反序列化封装、可配置 TTL 及连接失败优雅降级能力。缓存覆盖用户 Token（配置化）、验证码（5 分钟）、股价（5 分钟）、云图（5 分钟）、回测任务（7 天）等 8 类场景，实现从秒级到天的多 TTL 策略以平衡实时性与成本。

## Key Claims

- 支持主从连接池配置
- 连接失败只警告，不阻止应用启动
- Key 格式：`{domain}:{entity}:{identifier}`

## Related Pages

- [[task-scheduler-and-infrastructure|任务调度与基础设施]]
- [[Redis]]
- [[MainFundSelection]] — 选股系统依赖缓存

## Connections

- [[APScheduler]] — 缓存刷新任务调度
- [[RateLimiting]] — 滑动窗口限流基于 Redis 缓存
- [[A股市场]] — 大盘云图缓存