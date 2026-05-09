---
title: "DailyUsageStats"
type: entity
tags: [subscription, usage, model]
sources: [subscription-payment-system]
last_updated: 2026-05-09
---

# DailyUsageStats

每日使用统计模型，属于[[subscription-payment-system|订阅与支付系统]]。按天记录各功能（如 AI分析、批量分析、回测）的使用次数，用于限额检查。

## 默认限额 (`DEFAULT_LIMITS`)

| 功能 | free | pro | max |
|------|------|-----|-----|
| AI 分析日限 | -1（不限） | 50 | -1（不限） |
| 批量分析日限 | -1（不限） | 10 | -1（不限） |
| 批量股票数 | 5 | 30 | 100 |
| 回测日限 | -1（不限） | 20 | -1（不限） |

> `-1` 表示不限量。免费用户另有总使用次数（10次）和试用期（3天）限制。

See also: [[UserSubscription]], [[SubscriptionPlan]], [[subscription-payment-system]]