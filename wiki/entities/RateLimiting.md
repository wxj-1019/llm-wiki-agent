---
title: "RateLimiting"
type: entity
tags: [middleware, security]
sources: [task-scheduler-and-infrastructure]
last_updated: 2026-05-09
---

# RateLimiting

RateLimiting（请求限流）是平台基础设施的重要组成部分。在[[task-scheduler-and-infrastructure|任务调度与基础设施]]模块中，基于 Redis 的滑动窗口算法实现全局限流，支持按 IP、用户、端点三个维度进行限流，超出限制返回 429 Too Many Requests。认证端点（登录、验证码发送）包含额外的冷却期、日限流和失败锁定机制。

## Key Claims

- 位于 `app/middleware/rate_limit.py`
- 滑动窗口算法
- 三维度限流：IP / 用户 / 端点
- 认证端点增强保护：冷却期 + 日限流 + 失败锁定

## Connections

- [[Redis]] — 限流算法底层存储
- [[MainFundSelection]] — 选股系统 API 调用受限流保护
- [[王信杰]] — [[能源大数据平台]]涉及类似限流设计

## Related

- [任务调度与基础设施](sources/task-scheduler-and-infrastructure.md)