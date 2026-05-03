---
name: document-ingest
version: 1.0.0
author: llm-wiki-agent
description: 将文档摄入到 wiki 知识库
tags: [ingest, document, action]
priority: 20
requires:
  - wiki-data
---

# Document Ingest Skill

## Description
将用户指定的文档摄入到 wiki 知识库中。

## Usage
- 触发词：`ingest <文件路径>`
- 输入：文件路径
- 输出：摄入结果摘要
