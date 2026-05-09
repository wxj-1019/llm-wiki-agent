---
title: "RBAC"
type: entity
tags: [auth, permission, security]
sources: [user-auth-and-permission-system]
last_updated: 2026-05-09
---

RBAC（Role-Based Access Control，基于角色的访问控制）是[[用户与权限系统|用户与权限系统]]的核心权限管理模型。

## 角色
- 支持三层关联：用户 ↔ 角色 ↔ 权限
- 默认角色：`admin`、`user`、`guest`
- 权限由 `resource` + `action` 定义（如 `user:create`、`stock:read`）
- 超级用户（`is_superuser = True`）跳过所有权限检查
- 支持运行时动态分配/撤销角色和权限
- 权限校验方式：路由装饰器 `@require_permission()`、服务层查询、超级用户绕过