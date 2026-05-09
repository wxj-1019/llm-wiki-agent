---
title: "AlertSystem"
type: concept
tags: [alert, monitoring]
sources: [notification-and-messaging-system]
last_updated: 2026-05-09
---

# AlertSystem

告警系统（Alert System）分为两个层面：

1. **系统异常告警** — 记录系统异常，由管理员查看和处理，包含告警等级（info/warning/critical）和关联的异常日志/堆栈信息
2. **监控告警** — 由价格监控和 AI 盯盘触发，通过 [[NotificationService]] 统一投递

## 触发场景

- 价格触及止盈/止损阈值
- 技术指标异常信号
- AI 交易计划更新

## Connections

- [[NotificationService]] — 告警通过通知服务投递
- [[MainFundSelection|主力选股系统]] — 为选股系统的监控模块提供告警能力
- [[EventDriven|事件驱动]] — 告警触发采用事件模式