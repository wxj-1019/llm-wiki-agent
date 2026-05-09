---
title: "UserSubscription"
type: entity
tags: [subscription, model]
sources: [subscription-payment-system]
last_updated: 2026-05-09
---

# UserSubscription

用户订阅记录模型，属于[[subscription-payment-system|订阅与支付系统]]。

## 关键字段

- 状态：`active` / `cancelled` / `expired`
- 到期时间
- 自动续费标记

## 订阅策略

- 续费叠加：从 `max(当前时间, 原最晚到期时间)` 开始累加时长
- 升级处理：旧订阅标记为 `cancelled`，原因记为"升级订阅"
- 取消订阅：取消后自动降级为 `free`
- 过期检测：`check_subscription_status` 中判断到期时间并自动降级

See also: [[SubscriptionPlan]], [[DailyUsageStats]], [[subscription-payment-system]]