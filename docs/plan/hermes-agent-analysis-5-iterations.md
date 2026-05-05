# Hermes Agent × LLM Wiki Agent — 五轮迭代深度分析

> 分析日期：2026-05-04 | 基于 Hermes Agent v0.10.0 (133k⭐) | 5 轮迭代深化

---

## 第 0 轮：基础对比（已在前次分析中完成）

Hermes Agent 核心定位：自主 AI Agent，越用越强，内置闭环学习、技能系统、多平台网关、子 Agent 委托。

---

## 第 1 轮：架构层面对比与借鉴

### 1.1 技能系统（SKILL.md）深度对比

**Hermes 的 SKILL.md 规范**：
```yaml
---
name: my-skill
description: Brief description
version: 1.0.0
platforms: [macos, linux]
metadata:
  hermes:
    tags: [python, automation]
    category: devops
    fallback_for_toolsets: [web]
    requires_toolsets: [terminal]
---
# Skill Title
## When to Use
## Procedure
## Pitfalls
## Verification
```

**关键设计模式**：
- **渐进披露**（Progressive Disclosure）：Level 0 列表（~3k tokens）→ Level 1 完整内容 → Level 2 特定引用文件
- **条件激活**：技能可以根据可用工具集自动显示/隐藏（如 web 搜索不可用时才显示本地搜索替代方案）
- **平台过滤**：技能可限制在特定操作系统上加载
- **斜杠命令**：每个技能自动注册为 `/skill-name` 命令

**你的项目现状**：
- `tools/skill_engine.py` 使用 Jinja2 模板 + `_SAFE_NAME_RE` 校验
- 技能存储在 `tools/skills/` 目录，但格式是自定义的
- 没有渐进披露，加载技能就全量注入

**借鉴方案**：
1. 将技能格式改为 `SKILL.md` 兼容 agentskills.io 标准
2. 实现三级渐进披露：`skills_list()` → `skill_view(name)` → `skill_view(name, path)`
3. 添加条件激活机制：根据当前 LLM 模型能力决定加载哪些技能
4. 技能自动注册为斜杠命令（前端 CommandPalette 中可用）

### 1.2 记忆系统深度对比

**Hermes 的双文件记忆模型**：

| 文件 | 用途 | 字符限制 | 注入位置 |
|---|---|---|---|
| `MEMORY.md` | Agent 个人笔记——环境事实、约定、学到的东西 | 2,200 chars (~800 tokens) | 系统提示词 |
| `USER.md` | 用户画像——偏好、沟通风格、期望 | 1,375 chars (~500 tokens) | 系统提示词 |

**关键机制**：
- **冻结快照模式**：会话开始时注入一次，中途不更新（保护 LLM prefix cache 性能）
- **Agent 自我管理**：通过 `memory` 工具的 add/replace/remove 操作
- **容量限制驱动整合**：满时 Agent 必须整合或删除旧条目
- **Honcho 辩证用户建模**：从交互日志中提取任务偏好、决策历史、反馈信号
- **FTS5 跨会话搜索**：搜索历史对话 + LLM 摘要

**你的项目现状**：
- `wiki/overview.md` 是全局知识综合
- `wiki/entities/` + `wiki/concepts/` 是结构化知识
- 没有用户偏好记忆，没有 Agent 自我笔记
- `wiki/log.md` 是操作日志但不是记忆

**借鉴方案**：
1. 添加 `wiki/.agent/MEMORY.md` — Agent 学到的 wiki 管理经验（如"学术论文用 YAML frontmatter + Key Claims 格式"）
2. 添加 `wiki/.agent/USER.md` — 用户偏好（如"用户喜欢简短摘要，不喜欢冗长引用"）
3. 在 ingest/query 时注入这些文件作为系统上下文
4. 添加容量限制，强制 Agent 定期整合知识

### 1.3 子 Agent 委托机制对比

**Hermes 的 delegate_task 架构**：
```
主 Agent → delegate_task(goal, context, toolsets) → 子 Agent
子 Agent：全新对话、独立终端、受限工具集、无父级记忆访问
深度限制：MAX_DEPTH=2（父→子 OK，子→孙 禁止）
默认并发：3 个子 Agent
```

**五种协作模式**：
1. **串行执行** — 子 Agent 按顺序一个接一个
2. **并行执行** — 最多 3 个任务同时跑
3. **层级审核** — 实现 Agent → 规格审核 Agent → 质量审核 Agent
4. **对抗辩论** — 两个 Agent 对立观点迭代改进
5. **混合编排** — 串行 + 并行 + 审核 组合

**你的项目现状**：
- ingest 是单进程单 Agent
- 没有子 Agent 委托机制
- 批量 ingest 是顺序处理

**借鉴方案**：
1. 实现 `wiki-ingest-delegate` 模式：主 Agent 分析批量文档，分配给子 Agent 并行处理
2. 添加 `wiki-review` 子 Agent：专门负责审核 ingest 结果的质量
3. 深度限制防止递归（子 Agent 不能再创建子 Agent）

---

## 第 2 轮：功能扩展路径细化

### 2.1 闭环学习循环的具体实现路径

**当前状态**：
```
用户触发 ingest → Agent 读文档 → 写 wiki 页面 → 结束（无反馈循环）
```

**目标状态（借鉴 Hermes 的 self-improving loop）**：
```
用户触发 ingest
  → Agent 读文档
  → 写 wiki 页面
  → 自动运行 health.py 检查
  → 如果发现问题（孤立页面、断链）：
      → 自动修复或标记待处理
  → 反思："这个文档的处理模式可以提炼为技能吗？"
      → 如果可以：自动生成/更新 SKILL.md
  → 更新 MEMORY.md："学会了处理 XX 类型文档"
  → 记录到 log.md
```

**具体代码变更**：
1. `tools/ingest.py` 的 `ingest_markdown()` 末尾添加反思步骤
2. `tools/skill_engine.py` 添加 `auto_create_skill()` 方法
3. 新建 `tools/reflect.py` — ingest 后自动反思与技能提炼

### 2.2 内置定时任务系统

**借鉴 Hermes 的 cron 调度器**：

```python
# tools/scheduler.py (新文件)
SCHEDULES = {
    "daily-health": {"cron": "0 8 * * *", "action": "health", "notify": True},
    "weekly-lint":  {"cron": "0 2 * * 0", "action": "lint", "notify": True},
    "hourly-watch": {"cron": "0 * * * *",  "action": "watch_raw", "notify": False},
}
```

**与现有工具的关系**：
- `tools/watcher.py` → 合并入调度器作为 "watch_raw" 任务
- `tools/refresh.py` → 合并入调度器作为 "weekly-refresh" 任务
- `tools/health.py` → 每日自动运行
- `tools/lint.py` → 每周自动运行

### 2.3 多模型智能路由

**借鉴 Hermes 的模型选择策略**：

```python
TASK_MODEL_MAP = {
    "health":      {"model_env": "LLM_MODEL_FAST", "reason": "无 LLM 调用"},
    "ingest":      {"model_env": "LLM_MODEL",       "reason": "需要深度理解"},
    "query":       {"model_env": "LLM_MODEL",       "reason": "需要深度推理"},
    "lint":        {"model_env": "LLM_MODEL",       "reason": "需要语义分析"},
    "skill_create":{"model_env": "LLM_MODEL_FAST", "reason": "结构化输出"},
    "summarize":   {"model_env": "LLM_MODEL_FAST", "reason": "摘要任务较简单"},
}
```

**实现**：在 `tools/shared/llm.py` 的 `call_llm()` 中根据 `task_type` 参数选择模型。

---

## 第 3 轮：差异化竞争优势分析

### 3.1 你的项目有哪些 Hermes 没有的独特优势

| 维度 | LLM Wiki Agent | Hermes Agent | 你的优势 |
|---|---|---|---|
| **知识图谱** | vis.js + networkx + Louvain 社区检测 | 无图谱能力 | ✅ **唯一有可视化知识图谱的 wiki 系统** |
| **结构化知识** | entity/concept/source/synthesis 四层分类 | 只有 MEMORY.md + SKILL.md | ✅ **知识结构化程度远高于 Hermes 的扁平记忆** |
| **矛盾检测** | 跨页面矛盾自动标记 | 无此能力 | ✅ **独特的知识一致性保障** |
| **知识编译模式** | ingest 时一次性编译知识，后续查询零 LLM 调用 | 每次对话都要调 LLM | ✅ **成本效率极高** |
| **文件格式支持** | 20+ 格式通过 markitdown 自动转换 | 依赖外部工具 | ✅ **开箱即用的多格式支持** |
| **MCP 服务端** | 暴露 wiki_search/read/write/list/ingest 5 个工具 | MCP 客户端 + 服务端 | 需补齐客户端能力 |

### 3.2 如何将独特优势转化为可宣传的差异化定位

**当前定位**：`agent-driven knowledge management system`

**建议进化为**：`The wiki that compiles knowledge once and compounds forever — with a living knowledge graph that no other system has`

**三大差异化卖点**：
1. **"Compile Once, Query Forever"** — 知识在 ingest 时编译一次，后续查询不需要 LLM 调用（成本节约 90%+）
2. **"Living Knowledge Graph"** — 自动构建可视化知识图谱，发现隐含关系，检测矛盾
3. **"Agent-First Wiki"** — 不是人类维护的 wiki，而是 Agent 自主维护、自我改进的知识系统

---

## 第 4 轮：具体实施优先级与路线图

### 4.1 Phase 1：闭环学习（优先级最高）

| 任务 | 工作量 | 影响范围 |
|---|---|---|
| 添加 `wiki/.agent/MEMORY.md` + `USER.md` | 小 | ingest.py, query.py |
| 实现 `tools/reflect.py` 自动反思 | 中 | 新文件 |
| `skill_engine.py` 添加 `auto_create_skill()` | 中 | skill_engine.py |
| ingest 末尾调用反思 + 技能提炼 | 小 | ingest.py |
| 技能格式改为 SKILL.md 兼容 | 中 | skill_engine.py + 所有现有技能文件 |

### 4.2 Phase 2：定时自动化 + 多模型路由

| 任务 | 工作量 | 影响范围 |
|---|---|---|
| 新建 `tools/scheduler.py` | 中 | 新文件 |
| `call_llm()` 添加 `task_type` 路由 | 小 | shared/llm.py |
| 合并 watcher.py → scheduler.py | 中 | watcher.py |
| 前端添加调度管理面板 | 大 | wiki-viewer/ |

### 4.3 Phase 3：子 Agent 委托 + MCP 增强

| 任务 | 工作量 | 影响范围 |
|---|---|---|
| 实现 `delegate_ingest()` 并行处理 | 大 | 新模块 |
| MCP 客户端能力（连接外部 MCP Server） | 大 | 新模块 |
| 技能渐进披露机制 | 中 | skill_engine.py |
| 技能斜杠命令注册 | 中 | 前端 + 后端 |

### 4.4 Phase 4：多平台推送 + 开放生态

| 任务 | 工作量 | 影响范围 |
|---|---|---|
| 添加 Telegram/Discord 推送通知 | 中 | 新模块 |
| 兼容 agentskills.io 生态 | 小 | 文档 + 格式调整 |
| 技能 Hub 安装命令 | 中 | skill_engine.py |

---

## 第 5 轮：终极愿景 — LLM Wiki Agent 2.0

### 5.1 愿景陈述

> **LLM Wiki Agent 2.0 = Knowledge Compiler + Self-Improving Agent + Living Graph**
>
> 不仅是知识管理工具，而是一个**自我进化的知识编译引擎**：
> - 知识编译一次，永久可用（Compile Once）
> - Agent 越用越聪明，自动提炼技能（Self-Improving）
> - 知识图谱持续生长，发现隐藏关联（Living Graph）

### 5.2 核心架构演进

```
                    ┌─────────────────────────────────────┐
                    │         LLM Wiki Agent 2.0          │
                    ├─────────────────────────────────────┤
  raw/ ──ingest──▶ │  ┌───────────┐  ┌───────────────┐  │ ──query──▶ 答案
                    │  │ Knowledge │  │   Self-Improve │  │
                    │  │ Compiler  │  │     Engine     │  │
                    │  │ (ingest)  │  │ (reflect+skill)│  │
                    │  └─────┬─────┘  └───────┬───────┘  │
                    │        │                │           │
                    │        ▼                ▼           │
                    │  ┌─────────────────────────────┐   │
                    │  │      Living Knowledge        │   │
                    │  │  wiki/ + graph/ + skills/    │   │
                    │  │  + .agent/MEMORY + USER.md   │   │
                    │  └──────────┬──────────────────┘   │
                    │             │                       │
                    │  ┌──────────▼──────────────────┐   │
                    │  │     Automation Layer         │   │
                    │  │  scheduler + watcher + cron  │   │
                    │  └──────────┬──────────────────┘   │
                    │             │                       │
                    │  ┌──────────▼──────────────────┐   │
                    │  │     Delegation Layer         │   │
                    │  │  sub-agents for parallel     │   │
                    │  │  ingest + review + research  │   │
                    │  └─────────────────────────────┘   │
                    └─────────────────────────────────────┘
```

### 5.3 与 Hermes Agent 的关系定位

**不是竞争，而是互补**：

| 角色 | 工具 |
|---|---|
| **Hermes Agent** | 通用自主 Agent，擅长执行、调度、通信 |
| **LLM Wiki Agent** | 专用知识引擎，擅长编译、存储、图谱、检索 |

**最佳实践**：让 Hermes Agent 作为调度层，通过 MCP 协议调用 LLM Wiki Agent 的知识能力：
```
Hermes Agent → (MCP) → LLM Wiki Agent
                    ├── wiki_search("transformer")
                    ├── wiki_ingest("raw/paper.pdf")
                    ├── wiki_read("concepts/Transformer.md")
                    └── wiki_query("What are the main approaches?")
```

### 5.4 关键差异化总结（vs Hermes + autoresearch + 其他）

| 维度 | LLM Wiki Agent 2.0 | Hermes Agent | autoresearch | 传统 RAG |
|---|---|---|---|---|
| 知识持久化 | ✅ 结构化 wiki + 图谱 | ✅ 记忆文件 | ❌ 实验日志 | ❌ 向量数据库 |
| 知识可视化 | ✅ vis.js 交互图谱 | ❌ 无 | ❌ 无 | ❌ 无 |
| 自我改进 | ✅ 技能提炼 + 反思 | ✅ 技能创建 + 记忆 | ❌ 无 | ❌ 无 |
| 编译模式 | ✅ 一次编译永久可用 | ❌ 每次调 LLM | ❌ 每次跑实验 | ❌ 每次检索+生成 |
| 多格式支持 | ✅ 20+ 格式 | ✅ 依赖外部工具 | ❌ 仅 Python | ❌ 需要预处理 |
| 矛盾检测 | ✅ 跨页面自动检测 | ❌ 无 | ❌ 无 | ❌ 无 |
| MCP 协议 | ✅ 服务端 + 客户端 | ✅ 客户端 + 服务端 | ❌ 无 | ❌ 无 |
| 成本效率 | ✅ 极高（查询零 LLM） | ❌ 每次都调 LLM | ❌ 每次都跑实验 | ❌ 每次都调 LLM |

### 5.5 最终建议：三条核心行动线

**行动线 A — 闭环学习（1-2 周）**：
1. 添加 `.agent/MEMORY.md` + `USER.md`
2. 实现 `tools/reflect.py` 自动反思
3. 技能格式改为 SKILL.md 标准
4. ingest 末尾调用反思 → 技能提炼 → 记忆更新

**行动线 B — 自动化 + 多模型（2-3 周）**：
1. 新建 `tools/scheduler.py` 内置定时任务
2. `call_llm()` 添加任务类型 → 模型路由
3. 前端添加调度管理面板

**行动线 C — 开放生态（3-4 周）**：
1. MCP 客户端能力
2. 子 Agent 委托（并行 ingest）
3. 多平台推送通知
4. agentskills.io 生态兼容

---

## 附录：Hermes Agent 关键技术细节速查

### SKILL.md 完整格式
```yaml
---
name: skill-name              # 必填，1-64 字符，小写+连字符
description: What it does     # 必填，1-1024 字符
version: 1.0.0                # 可选
platforms: [macos, linux]     # 可选，限制操作系统
metadata:
  hermes:
    tags: [tag1, tag2]
    category: category-name
    fallback_for_toolsets: [web]     # 当 web 工具不可用时激活
    requires_toolsets: [terminal]    # 需要 terminal 工具才激活
    config:
      - key: my.setting
        description: "What this controls"
        default: "value"
---
# Skill Title
## When to Use
## Procedure
## Pitfalls
## Verification
```

### 记忆系统格式
```
MEMORY (your personal notes) [67% — 1,474/2,200 chars]
══════════════════════════════════════════════
User's project is a Rust web service at ~/code/myapi using Axum + SQLx
§
This machine runs Ubuntu 22.04, has Docker and Podman installed
§
User prefers concise responses, dislikes verbose explanations
```

### 子 Agent 委托 API
```python
# 单任务
delegate_task(
    goal="Debug why tests fail",
    context="Error: assertion in test_foo.py line 42",
    toolsets=["terminal", "file"]
)

# 并行批量（最多 3 个并发）
delegate_task(tasks=[
    {"goal": "Research topic A", "toolsets": ["web"]},
    {"goal": "Research topic B", "toolsets": ["web"]},
    {"goal": "Fix the build", "toolsets": ["terminal", "file"]}
])
```
