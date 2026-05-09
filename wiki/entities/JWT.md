---
title: "JWT"
type: entity
tags: [auth, security]
sources: [user-auth-and-permission-system]
last_updated: 2026-05-09
---

JWT（JSON Web Token）是[[用户与权限系统|用户与权限系统]]使用的认证令牌格式，用于在客户端和服务器之间安全传输声明。

## 角色
- 在[[用户与权限系统|用户与权限系统]]中作为主要的认证机制，登录成功后返回 JWT Access Token
- 默认过期时间通过 `settings.ACCESS_TOKEN_EXPIRE_MINUTES` 配置
- 支持 `/refresh` 端点刷新访问令牌