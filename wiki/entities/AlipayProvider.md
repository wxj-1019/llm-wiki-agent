---
title: "AlipayProvider"
type: entity
tags: [payment, alipay]
sources: [subscription-payment-system]
last_updated: 2026-05-09
---

# AlipayProvider

支付宝支付提供商，在[[subscription-payment-system|订阅与支付系统]]中通过 [[PaymentFactory]] 注册。实现了 [[BasePaymentProvider]] 定义的统一支付接口。

## 关键特性

- 使用 RSA2 签名（SHA256）
- 支持扫码支付（`trade.precreate`）、网页支付（`trade.page.pay`）、H5 支付（`trade.wap.pay`）
- 提供订单查询（`trade.query`）、退款（`trade.refund`）、关闭订单（`trade.close`）接口
- 通过环境变量和数据库 `payment_channels` 表配置，敏感信息通过文件路径读取
- 支持沙箱模式

## 支付流程

1. 创建订单 → 调用支付宝创建支付 → 返回 qr_code_url / redirect_url
2. 用户支付
3. 异步回调：验签 → 查重 → 金额校验 → 开通会员
4. 同步返回：验证签名 + 交易状态

See also: [[subscription-payment-system]]