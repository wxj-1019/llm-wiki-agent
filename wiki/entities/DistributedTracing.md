---
title: "DistributedTracing"
type: entity
tags: [middleware, observability]
sources: [task-scheduler-and-infrastructure]
last_updated: 2026-05-09
---

# DistributedTracing

DistributedTracing（分布式追踪）是平台可观测性的核心能力。在[[task-scheduler-and-infrastructure|任务调度与基础设施]]模块中，通过 `app/middleware/request_tracing.py` 为每个请求生成唯一 `trace_id`，该 ID 贯穿请求全生命周期（API → Service → DB → AI），所有日志统一关联 `trace_id`，便于问题排查和调用链分析。

## Key Claims

- 位于 `app/middleware/request_tracing.py`
- 每个请求生成唯一 `trace_id`
- `trace_id` 贯穿 API → Service → DB → AI 全链路
- 日志统一关联 `trace_id`

## Connections

- [[Prometheus]] — 性能指标与 trace_id 关联
- [[APScheduler]] — 定时任务执行也纳入追踪
- [[MainFundSelection]] — AI 调用链路追踪

## Related

- [任务调度与基础设施](sources/task-scheduler-and-infrastructure.md)
- 优化方向：集成 Jaeger/Zipkin 提供可视化调用链