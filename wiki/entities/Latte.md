---
title: "Latte"
type: entity
tags: [claude-code, fork, ai-agent, cli]
sources: [latte-claude-code-fork]
last_updated: 2026-05-08
---

# Latte

**Latte** 是 [[Anthropic]] [[ClaudeCode]] CLI（版本 2.1.90）的一个可构建分支（fork），由 wxj-1019 在 GitHub（https://github.com/wxj-1019/latte-code）上维护。核心差异包括移除遥测、移除安全硬编码守卫、解锁 54 个实验性功能、内置中文界面与多模型支持。

## Key Facts

- **运行时**：[[Bun]] >= 1.3.11
- **语言**：TypeScript（strict: false）
- **终端 UI**：React 19 + [[Ink]]
- **CLI 解析**：Commander.js
- **Schema 验证**：Zod v4
- **LLM SDK**：`@anthropic-ai/sdk` 及 Bedrock/Vertex/Foundry 变体
- **MCP 协议**：`@modelcontextprotocol/sdk`
- **Feature Flag**：编译时死代码消除（DCE）
- **发布**：NPM 平台分包（`@zenjiro-latte/latte-code`）

## 核心架构

查询流水线：`QueryEngine.submitMessage()` → 构建 System Prompt → 处理用户输入 → `query()` 循环（流式调用 API、解析 tool_use、权限检查、执行 Tool、循环直至 stop_reason）→ Auto Compact → 输出

## 支持的模型提供商

- [[Anthropic]]（默认）
- [[OpenAI]] 兼容（[[DeepSeek]]、Kimi、GLM、[[Qwen]]、[[Ollama]] 等）
- AWS Bedrock
- Google Vertex
- Anthropic Foundry

## Connections

- [[Claude]] — 上游 API 提供商
- [[Anthropic]] — 上游项目开发者
- [[HermesAgent]] — 同为 AI 工具，但侧重自我进化 Agent
- [[ClaudeCode]] — 上游基础项目
