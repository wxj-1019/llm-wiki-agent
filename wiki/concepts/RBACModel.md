---
title: "RBACModel"
type: concept
tags: [auth, permission, security]
sources: [user-auth-and-permission-system]
last_updated: 2026-05-09
---

RBAC 模型（Role-Based Access Control）是一种基于角色的访问控制模型。在[[用户与权限系统|用户与权限系统]]中实现为三层结构：用户 ↔ 角色 ↔ 权限。

## 核心结构
- **权限定义**：由 `resource`（资源，如 `user`、`stock`）+ `action`（动作，如 `create`、`read`）组合，如 `stock:analyze`
- **角色**：一组权限的集合，默认有 `admin`（全权限）、`user`、`guest`
- **用户-角色**：多对多关联，一个用户可拥有多个角色

## 与[[MainFundSelection|主力选股系统]]的关系
- 选股系统的 `stock:analyze`、`stock:read` 等权限通过 RBAC 控制
- 超级用户可绕过权限检查

## 与[[subscription-payment-system|订阅与支付系统]]的关系
- 用户的 `subscription_tier` 字段与 RBAC 结合，决定用户可以使用的功能范围