---
title: "BasePaymentProvider"
type: entity
tags: [payment, interface]
sources: [subscription-payment-system]
last_updated: 2026-05-09
---

# BasePaymentProvider

支付提供商的统一接口抽象类。在[[subscription-payment-system|订阅与支付系统]]中，由 [[PaymentFactory]] 管理，[[AlipayProvider]] 等具体实现遵循此接口。

## 统一接口

- 创建支付
- 查询订单
- 退款
- 关闭订单

See also: [[subscription-payment-system]]