---
title: "NotificationPersistence"
type: concept
tags: [notification, database, persistence]
sources: [notification-and-messaging-system]
last_updated: 2026-05-09
---

# NotificationPersistence

通知持久化（Notification Persistence）是指将所有通知记录保存到数据库，支持投递状态追踪和失败原因记录。

## 关键字段

- `monitored_stock_id` — 关联监控股票
- `notification_type` — 通知类型
- `delivery_status` — 投递状态（sent/failed/pending）
- `error_message` — 失败原因
- `channels` — 使用的渠道列表
- `created_at` — 创建时间

## 意义

- 提供完整的通知审计日志
- 支持失败重试和排查
- 可作为用户触达效果分析的数据基础

## Connections

- [[DataPipeline|数据管道]] — 通知数据是数据管道的一部分
- [[NotificationService]] — 持久化由通知服务管理