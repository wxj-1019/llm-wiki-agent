---
title: "bcrypt"
type: entity
tags: [auth, security, cryptography]
sources: [user-auth-and-permission-system]
last_updated: 2026-05-09
---

bcrypt 是一种密码哈希算法，[[用户与权限系统|用户与权限系统]]使用它来安全存储用户密码。

## 角色
- 在[[用户与权限系统|用户与权限系统]]中所有密码均通过 bcrypt 哈希存储
- `verify_password(plain, hashed)` 进行密码校验（超过72字节截断，bcrypt 原生限制）
- `get_password_hash(password)` 生成 bcrypt 密码哈希
- 密码校验在[[JWT|JWT]]认证流程中使用