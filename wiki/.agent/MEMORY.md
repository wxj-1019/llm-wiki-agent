---
title: "Agent Memory"
type: agent_memory
updated_at: "2026-05-06"
---

# Agent Memory

> Agent 学到的 wiki 管理经验。在 ingest/query 时注入作为系统上下文。
> 容量限制：~2200 字符。满时需整合或删除旧条目。

## Wiki 格式偏好

- 所有 wiki 页面必须包含 YAML frontmatter（title, type, tags, sources, last_updated）
- 实体页面命名：TitleCase.md（如 OpenAI.md, SamAltman.md）
- 概念页面命名：TitleCase.md（如 ReinforcementLearning.md, RAG.md）
- 来源页面命名：kebab-case.md

## 知识组织经验

- 新来源 ingest 后需更新 overview.md 的交叉引用
- 每个来源页面至少包含 Summary、Key Claims、Connections 三个段落
- 矛盾信息记录在 Contradictions 段落中

## 操作日志

- 每次 ingest/query 操作需追加到 wiki/log.md
- 格式：## [YYYY-MM-DD] <operation> | <title>
