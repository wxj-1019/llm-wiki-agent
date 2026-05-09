---
title: "TaskScheduling"
type: concept
tags: [infrastructure, automation]
sources: [task-scheduler-and-infrastructure]
last_updated: 2026-05-09
---

# TaskScheduling

任务调度是平台基础设施的核心模式，通过 [[APScheduler]] 统一管理所有定时任务的注册、触发和监控。支持 Cron 表达式、Interval 触发和 Date 触发三种方式，并集成交易日历感知功能——非交易时间自动跳过数据刷新任务，减少无效请求。

## Key Claims

- 集中注册管理，支持手动触发（`POST /tasks/{id}/run`）
- 交易日历感知：非交易时间跳过数据刷新
- 涵盖大盘指数、新闻、选股、回测、AI 预测等 12+ 任务

## Related Pages

- [[task-scheduler-and-infrastructure|任务调度与基础设施]]
- [[MainFundSelection]]
- [[APScheduler]]
- [[Backtesting]]

## Connections

- [[Redis]] — 缓存相关的定时刷新任务
- [[Prometheus]] — 任务执行性能指标采集