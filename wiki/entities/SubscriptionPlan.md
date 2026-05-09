---
title: "SubscriptionPlan"
type: entity
tags: [subscription, model]
sources: [subscription-payment-system]
last_updated: 2026-05-09
---

# SubscriptionPlan

订阅计划模型，属于[[subscription-payment-system|订阅与支付系统]]。包含套餐名称、显示名、价格以及各项日限额（AI分析、批量分析、回测等）。

## 套餐层级

| 套餐 | 标识 | 定位 |
|------|------|------|
| 免费版 | `free` | 基础功能，有限额限制 |
| 专业版 | `pro` | 高级功能，中等日限额 |
| 旗舰版 | `max` | 全功能，不限量 |

与 [[UserSubscription]] 和 [[DailyUsageStats]] 共同构成订阅模块的核心模型。

See also: [[subscription-payment-system]]