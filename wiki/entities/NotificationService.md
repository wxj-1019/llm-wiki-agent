---
title: "NotificationService"
type: entity
tags: [notification, service]
sources: [notification-and-messaging-system]
last_updated: 2026-05-09
---

# NotificationService

[[NotificationService]] 是通知与消息系统的统一入口服务，整合邮件、短信、站内信三种通知渠道。它懒加载 [[AIAgent|AI]] 分析服务，支持 AI 交易计划生成后自动推送。

## 支持渠道

- **邮件** — HTML 富文本，支持 3 次指数退避重试
- **短信** — 通过 sms_service 发送（开发环境使用模拟手机号）
- **站内信** — 系统内部通知，用户登录后查看

## 通知类型

`target_profit`（止盈）、`stop_loss`（止损）、`price_alert`（价格告警）、`system`（系统公告）、`ai_plan`（AI交易计划）、`technical_alert`（技术指标告警）

## Connections

- [[MainFundSelection|主力选股系统]] — 为其监控模块提供通知投递能力
- [[EventDriven|事件驱动]] — 通知投递采用事件驱动模式