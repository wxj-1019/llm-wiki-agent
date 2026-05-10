---
title: "Claude Code CLAUDE.md — 项目指南与构建系统"
type: source
tags: [claude-code, build-system, architecture]
date: 2026-05-10
source_file: raw/uploads/CLAUDE.md
---

## Summary

本文档是 [[ClaudeCode]] 项目仓库根目录下的 `CLAUDE.md` 文件，为 [[Claude]] Code (claude.ai/code) 提供项目代码工作的指导。内容涵盖常见命令、高层架构、构建系统（功能标志打包器）和入口点/UI 循环。该仓库使用 [[Bun]] 作为运行时和包管理器，[[Ink]]/[[React]] 构建终端 UI。

## Key Claims

- 项目使用 [[Bun]] 进行依赖管理、构建和运行，标准输出为 `./cli` 二进制
- 构建系统支持功能标志打包，通过 `--feature` 或 `--feature-set` 预设控制
- 核心入口点为 `src/entrypoints/cli.tsx`，主交互 UI 位于 `src/screens/REPL.tsx`（[[Ink]]/[[React]]）
- LLM 查询管道由 `src/QueryEngine.ts` 协调消息流、工具使用和模型调用
- 主要子系统包括：服务（API 客户端、OAuth/MCP）、状态管理、React Hooks、终端组件（Ink）、技能系统、插件系统、IDE 桥接、语音输入和后台任务管理
- 支持 OAuth 登录方式：`./cli /login`

## Key Quotes

> "scripts/build.ts is the build script and feature-flag bundler."
> "Feature flags are set via build arguments (e.g., `--feature=ULTRAPLAN`) or presets like `--feature-set=dev-full`"

## Connections

- [[ClaudeCode]] — 该 CLAUDE.md 文件即为 Claude Code 的指导文档
- [[Claude]] — Anthropic 的 AI 助手，Claude Code 基于其 API
- [[Bun]] — 项目的包管理和构建运行时
- [[Ink]] — 用于构建终端 UI 的 React 渲染库
- [[React]] — UI 框架，用于 CLI 界面组件
- [[Anthropic]] — Claude Code 和 Claude API 的创建者

## Contradictions

None detected with existing wiki content.