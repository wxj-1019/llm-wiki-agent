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
- 学术论文类来源应提取核心贡献、关键实体和概念链接
- 操作日志日期需与日志条目严格一致，避免手动录入错误
- 定期检查并合并重复条目，保持 Memory 简洁
- 对于无来源页面的 ingest，应标记为待补充来源摘要


## 操作日志

- [2026-05-08] reflection | 分析 ingest 操作，提取学术论文处理模式，修复日期不一致和重复条目
- [2026-05-09] reflection | 分析 ingest 操作，修复日志格式和重复问题，合并 Memory 重复条目，标记无来源页面待补充

## Knowledge Organization Experience
- - 对于无来源页面的 ingest，应标记为待补充来源摘要
- 测试 ingest 脚本执行后需确认是否产生有效来源页面，否则应清理或补充日志说明
- 测试 ingest 脚本执行后需确认是否产生有效来源页面，否则应清理或补充日志说明
- 操作日志条目应避免重复日期，同一日期多条记录需合并或使用时间戳区分
- 新来源 ingest 后需更新 overview.md 的交叉引用
- 每个来源页面至少包含 Summary、Key Claims、Connections 三个段落
- 矛盾信息记录在 Contradictions 段落中
- 学术论文类来源应提取核心贡献、关键实体和概念链接
- 操作日志日期需与日志条目严格一致，避免手动录入错误
- 定期检查并合并重复条目，保持 Memory 简洁
- 对于无来源页面的 ingest，应标记为待补充来源摘要
- 测试 ingest 脚本执行后需确认是否产生有效来源页面，否则应清理或补充日志说明
- 操作日志条目应避免重复日期，同一日期多条记录需合并或使用时间戳区分

## Operation Log
- [2026-05-14] [2026-05-14] reflection | 分析测试 ingest 脚本执行，标记无来源页面待补充，确认测试流程需产出有效来源摘要
- [2026-05-14] [2026-05-14] reflection | 分析测试 ingest 脚本执行，发现无来源页面产出及日志日期重复，标记待修复
- [2026-05-14] [2026-05-14] reflection | 分析图重建操作，发现无来源页面产出及日志日期重复，合并重复条目，标记图重建为维护动作
