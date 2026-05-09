---
title: "MembershipTiering"
type: concept
tags: [subscription, product-design]
sources: [subscription-payment-system]
last_updated: 2026-05-09
---

# MembershipTiering

会员分层设计概念。在[[subscription-payment-system|订阅与支付系统]]中采用三档套餐（free/pro/max）覆盖从体验用户到专业用户的全层级。

## 设计要点

- **免费版（free）**：体验产品价值，有限额（总使用10次，试用期3天）
- **专业版（pro）**：高级功能，中等日限额（AI分析50次/日，批量分析10次/日）
- **旗舰版（max）**：全功能，不限量

## 关键策略

- 续费叠加：从 `max(当前时间, 原最晚到期时间)` 开始累加时长
- 升级处理：旧订阅标记为 `cancelled`，原因记为"升级订阅"
- 取消订阅：取消后自动降级为 `free`

这种设计鼓励用户从免费版开始使用，逐步升级到付费版。

See also: [[SubscriptionPlan]], [[UserSubscription]], [[subscription-payment-system]]