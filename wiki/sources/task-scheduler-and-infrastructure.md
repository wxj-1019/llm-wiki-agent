---
title: "任务调度与基础设施 — 平台底层运行支撑模块"
type: source
tags: [task-scheduler, infrastructure, redis, monitoring, rate-limiting]
date: 2026-05-09
source_file: raw/uploads/15_任务调度与基础设施.md
---

## Summary

本文档详细描述了一个平台的核心基础设施层，包括基于 [[APScheduler]] 的任务调度系统、[[Redis]] 缓存管理、多级请求限流、全链路日志追踪与 [[Prometheus]] 性能监控。该模块为[[MainFundSelection|主力选股系统]]等上层业务提供稳定、高效、可观测的运行环境，并集成了交易日历感知、优雅降级、多环境配置等设计亮点。

## Key Claims

- 任务调度基于 APScheduler 封装，支持 Cron、Interval、Date 三种触发方式，覆盖大盘指数刷新、新闻抓取、主力选股、AI 预测反馈等 12+ 定时任务
- Redis 缓存管理器支持连接池管理、JSON 序列化、可配置 TTL 及连接失败优雅降级（仅警告不阻止启动），覆盖 Token、验证码、股价、云图等 8 类缓存场景
- 全局限流基于 Redis 滑动窗口算法，支持按 IP/用户/端点维度限流，认证端点额外包含冷却期+日限流+失败锁定
- 每个请求生成唯一 `trace_id`，贯穿 API → Service → DB → AI 全生命周期，日志统一关联
- Prometheus 指标暴露 HTTP 请求数/耗时、AI 调用数/耗时、DB 查询耗时、缓存命中率等标准化指标
- 配置管理基于 pydantic-settings，支持多环境隔离，密钥从环境变量读取

## Key Quotes

> "任务调度与基础设施模块是平台的底层运行支撑，包含 APScheduler 定时任务调度、Redis 缓存管理、多级请求限流、全链路日志追踪、Prometheus 性能监控等核心基础设施。"
>
> "非交易时间自动跳过数据刷新任务" — 交易日历感知
>
> "Redis 连接失败只警告，不阻止应用启动" — 优雅降级

## Connections

- [[MainFundSelection]] — 主力选股系统依赖本模块的定时任务（每日/每周选股、回测）和 Redis 缓存
- [[APScheduler]] — 任务调度系统的核心引擎
- [[Redis]] — 缓存管理器与滑动窗口限流的底层存储
- [[Prometheus]] — 性能监控指标暴露
- [[A股市场]] — 交易日历感知与大盘指数刷新
- [[Tushare]] — 作为数据源被缓存（Key: `tushare:{api_name}:{params_hash}`）
- [[Backtesting]] — 回测任务缓存（7 天 TTL）与进度缓存（1 小时 TTL）
- [[王信杰]] — 该模块与[[能源大数据平台]]在 Redis 集群、微服务方面的技术栈有相似性

## Contradictions

- 文档提到 Redis 连接失败时"只警告，不阻止启动"，这与通常的生产要求（强依赖系统启动前需确认连接正常）存在矛盾。设计文档将其列为"优雅降级"，但实际操作中 Redis 不可用可能导致缓存雪崩。
- 文档提出"APScheduler 替换为 Celery + RabbitMQ/Redis"作为优化方向，但在同一文档中 Redis 已被用于限流和缓存。若 Redis 是瓶颈，引入 Celery 可能会增加系统复杂度而非解决根本问题。
- 文档未明确提及[[MainFundSelection|主力选股系统]]的MLX、[[DeepSeekV3]]等 AI 模型调用是否归入 `ai_requests_total` 指标，导致监控范围边界模糊。

## Optimization Points Noted

| 优化方向 | 说明 |
|----------|------|
| 分布式任务队列 | APScheduler 替换为 Celery + RabbitMQ/Redis |
| 链路追踪增强 | 集成 Jaeger/Zipkin 提供可视化调用链 |
| 健康检查端点 | 增加 /health /ready /live 探针 |
| 配置中心 | 引入 Nacos/Apollo 配置中心支持热更新 |
| 灰度发布 | 支持按用户比例灰度发布新功能 |
| 混沌工程 | 定期注入故障验证系统韧性 |
