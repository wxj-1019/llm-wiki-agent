---
title: "OrderStatus"
type: entity
tags: [payment, order]
sources: [subscription-payment-system]
last_updated: 2026-05-09
---

# OrderStatus

订单状态枚举，定义在[[subscription-payment-system|订阅与支付系统]]中。

## 状态流转

```
PENDING → PAID / CLOSED / EXPIRED / FAILED
PAID → REFUNDING / PARTIAL_REFUNDED
REFUNDING → REFUNDED / PARTIAL_REFUNDED / PAID
PARTIAL_REFUNDED → REFUNDING / REFUNDED
```

- 支持部分退款，退款记录独立保存到 `RefundRecord` 表
- 幂等设计：`idempotency_key` + `notify_id` 查重
- 乐观锁：`version` 字段防止并发修改

See also: [[subscription-payment-system]]