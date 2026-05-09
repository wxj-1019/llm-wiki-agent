---
title: "订阅与支付系统"
type: source
tags: [subscription, payment, alipay, membership]
date: 2026-05-09
source_file: raw/uploads/12_订阅与支付系统.md
---

## Summary

该文档详细描述了一个平台的订阅与支付系统，设计为平台的商业化变现引擎。系统提供 free/pro/max 三档会员套餐，集成支付宝支付，支持订阅购买、自动续费、退款和使用限额控制。架构采用工厂模式与提供商模式统一支付接口，便于未来扩展其他支付渠道（如微信支付）。

## Key Claims

- 系统提供三层套餐（free/pro/max），覆盖从体验用户到专业用户的层级
- 使用限额精细化，按功能维度（AI分析/批量分析/回测）分别设置限额
- 采用工厂模式 + 提供商模式，通过 PaymentFactory 统一支付接口
- 支付流程包含创建订单、异步回调验签、查重、金额校验和订阅激活
- 支持部分退款，退款记录独立保存到 RefundRecord 表
- 续费策略为叠加时长，升级时旧订阅标记为 cancelled
- 免费用户有总使用次数（10次）和试用期（3天）限制，过期完全禁用

## Key Quotes

> "订阅与支付系统是平台的商业化变现引擎"
> "工厂模式 + 提供商模式统一支付接口，便于未来扩展其他支付渠道"
> "续费叠加：从 max(当前时间, 原最晚到期时间) 开始累加时长"

## Connections

- [[AlipayProvider]] — 支付宝支付提供商，使用 RSA2 签名，支持扫码/网页/H5 支付
- [[BasePaymentProvider]] — 定义统一支付接口（创建/查询/退款/关闭）
- [[PaymentFactory]] — 注册支付提供商的工厂类
- [[SubscriptionPlan]] — 订阅计划模型，包含名称、价格、各项日限额
- [[UserSubscription]] — 用户订阅记录，包含状态、到期时间、自动续费标记
- [[DailyUsageStats]] — 每日使用统计，按天记录各功能使用次数
- [[OrderStatus]] — 订单状态流转：PENDING → PAID / CLOSED / EXPIRED / FAILED，以及退款相关状态

## Contradictions

None detected.
