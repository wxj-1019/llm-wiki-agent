---
title: "Latte — Claude Code 可构建分支 (AGENTS.md)"
type: source
tags: [claude-code, fork, latte, bun, typescript, ai-agent]
date: 2026-05-08
source_file: raw/uploads/AGENTS.md
---

## Summary

AGENTS.md 是 **latte** 项目的操作指引文件。latte 是 [[Anthropic]] [[Claude]] Code CLI（版本 2.1.90）的一个可构建分支（fork），由用户 wxj-1019 维护。核心差异包括：移除遥测、移除安全硬编码守卫、解锁 54 个实验性功能、内置中文界面与多模型支持（通过 [[OpenAI]] 兼容适配器接入 [[DeepSeek]]、Kimi、GLM、[[Qwen]]、[[Ollama]] 等第三方模型）。项目使用 [[Bun]] 运行时（>=1.3.11）和 TypeScript 开发，基于 React 19 + [[Ink]] 构建终端 UI，采用 Feature Flag 编译时死代码消除（DCE）机制。

## Key Claims

- Latte 移除了所有外部分析、崩溃报告和会话指纹采集，并提供更开放的控制权
- 通过编译时特性开关解锁 54 个上游默认禁用的实验性功能
- 内置中文交互支持，可通过 OpenAI 兼容适配器接入 [[DeepSeek]]、Kimi、GLM、[[Qwen]]、[[Ollama]] 等第三方模型
- 使用 Bun 作为运行时和构建工具，采用 `bun build --compile` 打包为单个可执行文件
- 构建时 Feature Flag 通过 `feature()` 函数实现死代码消除（DCE），未启用功能在编译时被移除
- 查询流水线核心：`QueryEngine.submitMessage()` → 构建 System Prompt → 处理用户输入 → `query()` 循环（流式调用 API、解析 tool_use、权限检查、执行 Tool、循环直至 stop_reason）→ Auto Compact → 输出
- 支持多种模型提供商：[[Anthropic]]（默认）、[[OpenAI]] 兼容、AWS Bedrock、Google Vertex、Anthropic Foundry
- 项目无自动化测试套件，完全依赖手动测试
- 采用 NPM 平台分包发布模式（`@zenjiro-latte/latte-code`），与 esbuild、prisma 等行业标准一致
- 源自 [[Anthropic]] 的 [[ClaudeCode]] 项目（https://docs.anthropic.com/en/docs/claude-code）

## Key Quotes

> "latte 是 Anthropic Claude Code CLI 的一个可构建分支（fork）"

> "移除遥测：去除了所有外部分析、崩溃报告和会话指纹采集。"

> "Feature Flag 通过 bun:bundle 的 feature() 函数实现编译时死代码消除（DCE）。未启用的 feature 会在构建时被整体移除。"

## Connections

- [[Claude]] — 上游项目 Claude Code CLI 的创造者
- [[Anthropic]] — 上游项目的开发者
- [[Bun]] — 核心运行时和构建工具
- [[OpenAI]] — 兼容适配层，支持接入外部模型
- [[DeepSeek]] — 通过 OpenAI 兼容适配支持的第三方模型提供商
- [[Qwen]] — 通过 OpenAI 兼容适配支持的第三方模型提供商
- [[Ollama]] — 本地模型运行平台，通过 OpenAI 兼容适配支持
- [[Ink]] — 终端 UI 框架（React for CLI）
- [[MCP]] — Model Context Protocol，通过 `@modelcontextprotocol/sdk` 支持
- [[TypeScript]] — 项目语言
- [[React]] — 终端 UI 层使用的框架
- [[HermesAgent]] — 同为 AI Agent 类工具，但 latte 更偏向 CLI 编程助手而非自主 Agent
- [[ClaudeCode]] — 上游基础项目

## Contradictions

- 与[[github-hermes-ecosystem|GitHub Hermes 生态系统综述]]无直接矛盾，两者属于不同领域的 AI 编程工具（latte 专注于 CLI 编程助手，Hermes Agent 专注于自我进化 AI Agent）
- 与现有 wiki 中关于 [[ClaudeCode]] 的描述无冲突，latte 本质是 Claud Code 的可选分支，拓展了其功能和可插拔性
