---
title: "APScheduler"
type: entity
tags: [task-scheduler, python]
sources: [task-scheduler-and-infrastructure]
last_updated: 2026-05-09
---

# APScheduler

APScheduler（Advanced Python Scheduler）是一个轻量级的 Python 定时任务调度库。在[[task-scheduler-and-infrastructure|任务调度与基础设施]]模块中被封装为核心调度引擎，支持 Cron 表达式、Interval 触发和 Date 触发三种方式。该模块基于 APScheduler 统一管理 12+ 定时任务，包括大盘指数刷新、新闻抓取、主力选股等。

## Key Claims

- 支持 Cron/Interval/Date 三种触发方式
- 所有定时任务集中注册管理，支持手动触发
- 位于 `app/services/task_scheduler/`

## Connections

- [[MainFundSelection]] — 主力选股系统依赖 APScheduler 调度的每日/每周选股任务
- [[Redis]] — 缓存管理调度
- [[Prometheus]] — 定时任务性能指标采集
- [[Backtesting]] — 回测任务调度

## Related

- [任务调度与基础设施](sources/task-scheduler-and-infrastructure.md)
- [[能源大数据平台]] — 类似的任务调度架构