---
name: wiki-query
version: 1.0.0
author: llm-wiki-agent
description: 基于 wiki 知识库回答用户问题
tags: [query, rag, knowledge]
priority: 10
requires:
  - litellm
  - wiki-data
---

# Wiki Query Skill

## Description
搜索 wiki 知识库中的相关页面，综合回答用户问题。

## Usage
- 触发词：用户提出关于 wiki 内容的问题
- 输入：自然语言问题
- 输出：带 [[wikilinks]] 引用的综合答案

## Workflow
1. 解析用户问题，提取关键词
2. 搜索 wiki 中相关页面（使用 /api/search）
3. 提取相关片段
4. 调用 LLM 综合回答
5. 可选：保存为 synthesis 页面

## Example Prompts
- "Transformer 架构的核心创新是什么？"
- "OpenAI 和 Google 在 LLM 领域有什么关系？"
- "总结一下 wiki 中关于 AI Agent 的内容"
