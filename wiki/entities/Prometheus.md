---
title: "Prometheus"
type: entity
tags: [monitoring, metrics]
sources: [task-scheduler-and-infrastructure]
last_updated: 2026-05-09
---

# Prometheus

Prometheus 是一个开源的系统监控和告警工具包。在[[task-scheduler-and-infrastructure|任务调度与基础设施]]模块中，通过 `app/core/metrics/prometheus_exporter.py` 暴露标准化性能指标，包括 HTTP 请求数/耗时、AI 调用数/耗时、DB 查询耗时和缓存命中率等，便于对接 Grafana 监控面板。

## Key Claims

- 暴露指标端点：`GET /metrics`
- 指标类型：Counter、Histogram、Gauge
- 支持 AI 调用、数据库查询等多维度监控

## Connections

- [[Redis]] — 缓存命中率指标（cache_hit_ratio）
- [[APScheduler]] — 任务执行性能采集
- [[MainFundSelection]] — AI 调用性能监控（`ai_requests_total`）
- [[王信杰]] — [[能源大数据平台]]也涉及监控系统

## Related

- [任务调度与基础设施](sources/task-scheduler-and-infrastructure.md)