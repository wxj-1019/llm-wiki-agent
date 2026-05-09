---
title: "用户与权限系统"
type: source
tags: [auth, rbac, user-management, security]
date: 2026-05-09
source_file: raw/uploads/01_用户与权限系统.md
---

## Summary

用户与权限系统是平台的**基础支撑层**，提供完整的用户生命周期管理（注册/登录/信息维护）和基于角色的访问控制（RBAC）。系统采用 [[JWT]] Token 认证机制，密码使用 [[bcrypt]] 哈希存储，验证码服务基于 [[Redis]] 实现冷却期、日限流和防暴力破解锁定。该模块是整个平台所有上层业务（如[[MainFundSelection|主力选股系统]]、[[backtest-engine|回测引擎]]等）的用户入口和安全基石。

## Key Claims

- 基于 [[JWT]] + [[bcrypt]] + [[Redis]] 实现多字段登录（用户名/手机号/邮箱）的认证体系
- 验证码服务具备冷却期、日限流、连续失败锁定三层防刷机制
- [[RBAC]] 系统支持角色-权限-用户三层关联，运行时动态分配，超级用户可绕过检查
- 用户删除时级联清理所有关联数据（持仓、监控、分析记录等）
- 开发友好：`SMS_ENABLED=false` 时验证码直接通过

## Key Quotes

> “用户与权限系统是整个平台的**基础支撑层**，提供完整的用户生命周期管理和基于角色的访问控制（RBAC）。”

> “验证码防刷：冷却期 + 日限流 + 失败锁定三层防护。”

## Connections

- [[MainFundSelection|主力选股系统]] — 用户系统是选股系统的用户入口和权限控制基础
- [[backtest-engine|回测引擎]] — 回测记录通过用户关联，用户删除时级联清理
- [[Redis]] — 验证码存储、冷却期、限流、锁定的基础设施
- [[subscription-payment-system|订阅与支付系统]] — 用户模型的 `subscription_tier` 和 `subscription_expires_at` 字段与订阅系统关联
- [[notification-and-messaging-system|通知与消息系统]] — 通知记录通过用户关联
- [[user-profile-system|用户画像系统]] — 用户画像基于用户系统构建
- [[price-monitoring-and-alert-system|价格监控与预警系统]] — 监控股票通过用户关联
- [[data-model-overview|数据模型总览]] — 用户模型是数据模型的核心实体之一
- [[JWT]] — 认证令牌
- [[bcrypt]] — 密码哈希算法
- [[RBAC]] — 角色权限控制

## Contradictions

None detected with existing wiki content.