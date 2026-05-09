---
title: "PaymentFactoryPattern"
type: concept
tags: [design-pattern, payment]
sources: [subscription-payment-system]
last_updated: 2026-05-09
---

# PaymentFactoryPattern

支付工厂模式，在[[subscription-payment-system|订阅与支付系统]]中用于统一管理支付渠道。采用工厂模式 + 提供商模式：

- [[PaymentFactory]] 注册具体支付提供商（如 [[AlipayProvider]]）
- [[BasePaymentProvider]] 定义统一接口
- 便于扩展其他支付渠道（如微信支付、Apple Pay、Google Pay）

这种方法的核心优势是支付逻辑与业务逻辑解耦，新增支付渠道时只需实现 `BasePaymentProvider` 接口并在工厂注册。

See also: [[subscription-payment-system]]