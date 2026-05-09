---
title: "NotificationChannels"
type: concept
tags: [notification, architecture]
sources: [notification-and-messaging-system]
last_updated: 2026-05-09
---

# NotificationChannels

通知渠道（Notification Channels）定义了用户触达的不同方式。在 [[NotificationService]] 中，实现了三种渠道：

- **邮件** — 最正式的沟通方式，支持 HTML 富文本
- **短信** — 即时性强，适合紧急告警
- **站内信** — 系统内部通知，用户登录后查看

## 设计要点

- 统一封装：所有渠道由 [[NotificationService]] 统一管理
- 投递状态追踪：每条通知记录 sent/failed/pending 状态
- 失败重试：邮件支持 3 次指数退避重试
- 可扩展：未来可增加 WebSocket 实时推送、微信通知等新渠道

## Connections

- [[EventDriven|事件驱动]] — 通知分发采用事件驱动架构
- [[MainFundSelection|主力选股系统]] — 作为选股系统的通知基础设施