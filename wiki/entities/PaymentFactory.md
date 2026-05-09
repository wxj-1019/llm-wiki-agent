---
title: "PaymentFactory"
type: entity
tags: [payment, factory-pattern]
sources: [subscription-payment-system]
last_updated: 2026-05-09
---

# PaymentFactory

支付提供商工厂，采用工厂模式注册和管理支付渠道。在[[subscription-payment-system|订阅与支付系统]]中注册了 [[AlipayProvider]]。

## 设计意图

- 统一支付接口，便于扩展其他支付渠道（如微信支付、Apple Pay、Google Pay）
- 与 [[BasePaymentProvider]] 配合实现提供商模式

See also: [[subscription-payment-system]]