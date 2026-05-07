---
title: "Ink"
type: entity
tags: [react, terminal-ui, cli]
sources: [latte-claude-code-fork]
last_updated: 2026-05-08
---

# Ink

**Ink** 是一个使用 [[React]] 构建命令行界面（CLI）的框架，由 Vadim Demedes 开发。在 [[latte-claude-code-fork|Latte]] 项目中，Ink 用于构建终端用户界面（TUI），包括主交互界面（REPL）和各种命令的 UI 组件。

## Key Facts

- 允许使用 React 组件来渲染命令行界面
- 支持 JSX、组件化、生命周期等 React 概念
- 在 [[Latte]] 项目中使用了内置 fork（`src/ink/`）
- 官方网站：https://github.com/vadimdemedes/ink

## Connections

- [[React]] — Ink 基于 React
- [[Latte]] — 项目中用作终端 UI 框架
- [[ClaudeCode]] — 上游项目也使用 Ink（但 latte 使用了定制 fork）
