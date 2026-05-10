---
title: "Bun"
type: entity
tags: [javascript, runtime, build-tool]
sources: [latte-claude-code-fork]
last_updated: 2026-05-08
---

# Bun

**Bun** 是一个高性能 JavaScript/TypeScript 运行时和打包工具，由 Jarred Sumner 创建。在 [[latte-claude-code-fork|Latte]] 项目中，Bun >= 1.3.11 是必需的运行时和构建工具。

## Key Facts

- 同时作为运行时和包管理器使用
- 支持 TypeScript 直接运行（无需编译）
- 在 [[latte-claude-code-fork|Latte]] 项目中：
  - 使用 `bun build --compile` 将源码和 node_modules 打包为单文件二进制
  - 通过 `bun:bundle` 的 `feature()` 函数实现编译时死代码消除
  - 开发命令：`bun run dev`、`bun run build`、`bun run compile`

## Connections

- TypeScript — Bun 原生支持
- [[ClaudeCode]] — Latte 上游项目也依赖 Bun
