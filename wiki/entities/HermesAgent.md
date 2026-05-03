---
title: "HermesAgent"
type: entity
tags: [ai-agent, open-source, hermes, nous-research]
sources: [github-hermes-ecosystem]
last_updated: 2026-05-02
---

> **Disambiguation**: This page is about **Hermes Agent**, an AI Agent framework by [[NousResearch]]. For Meta's JavaScript engine also named Hermes, see [[HermesJSEngine]].

## Overview

Hermes Agent 是由 NousResearch 开发的开源自我进化 AI Agent，GitHub 星标数 128,747，是当前最热门的 AI Agent 项目之一。口号："The agent that grows with you"。它与 Meta 的 [[HermesJSEngine]]（React Native JS 引擎）是完全无关的项目，仅名称相同。

## Core Features

### 1. 自我学习闭环
- 从复杂任务中自主创建技能（Skills）
- 使用过程中持续改进技能
- FTS5 全文搜索历史会话 + LLM 摘要实现跨会话回忆
- Honcho 方言式用户建模，构建用户画像

### 2. 多模型支持
支持任意 LLM 提供商，一条命令切换：
- Nous Portal、OpenRouter（200+ 模型）
- NVIDIA NIM (Nemotron)、Xiaomi MiMo
- z.ai/GLM、Kimi/Moonshot、MiniMax
- Hugging Face、OpenAI、自定义端点

### 3. 多平台接入
- CLI（全功能 TUI）
- Telegram、Discord、Slack、WhatsApp、Signal
- 语音备忘录转录、跨平台对话连续性

### 4. 调度自动化
- 内置 cron 调度器
- 支持自然语言描述任务
- 每日报告、夜间备份、每周审计

### 5. 子代理与并行化
- 生成隔离子代理进行并行工作流
- 通过 RPC 调用工具的 Python 脚本
- 多步骤管道压缩为零上下文成本

### 6. 多种运行环境
六种终端后端：local、Docker、SSH、Daytona、Singularity、Modal

## Technical Stack

- **语言**：Python
- **许可证**：MIT
- **安装**：`curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash`
- **支持平台**：Linux、macOS、WSL2、Android (Termux)

## Ecosystem

| 项目 | Stars | 说明 |
|---|---|---|
| hermes-webui | 5,299 | Web/手机端界面 |
| hermes-web-ui | 3,261 | 多平台管理面板（Vue3） |
| hermes-workspace | 2,837 | 原生 Web 工作区 |
| hermes-agent-self-evolution | 2,675 | 自我进化框架（DSPy+GEPA） |
| awesome-hermes-agent | 2,212 | 资源和技能列表 |
| hermes-agent-orange-book | 3,444 | 中文橙皮书教程 |

## Connections

- [[NousResearch]] — 开发组织
- [[AIAgent]] — 所属概念
- [[SelfImprovingAI]] — 核心理念
- [[OpenAI]] — 支持的模型提供商
- [[AgentFrameworkComparison]] — 与其他 Agent 框架对比
