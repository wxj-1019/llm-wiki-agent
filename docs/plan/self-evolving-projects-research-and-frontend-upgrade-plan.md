# GitHub 自我进化 AI 项目调研 & 前端交互升级方案

> 生成日期: 2026-05-11
> 调研范围: GitHub 150+ 自我进化项目、2026 年 Agentic UI 最佳实践、竞品前端架构分析
> 迭代轮次: 5 轮深度迭代

---

## 目录

1. [调研背景与方法](#一调研背景与方法)
2. [核心项目深度分析](#二核心项目深度分析)
3. [自我进化机制技术实现对比](#三自我进化机制技术实现对比)
4. [2026 前端交互范式迁移](#四2026-前端交互范式迁移)
5. [你的项目现状评估](#五你的项目现状评估)
6. [前端升级方案](#六前端升级方案)
7. [实现优先级路线图](#七实现优先级路线图)
8. [差异化竞争策略](#八差异化竞争策略)

---

## 一、调研背景与方法

### 1.1 调研目标

- 搜索 GitHub 上具有自我进化能力的 AI 项目，评估借鉴价值
- 分析竞品前端交互模式，识别可迁移的设计范式
- 为 llm-wiki-agent 的前端升级提供可落地的方案

### 1.2 调研范围

| 维度 | 覆盖内容 |
|------|---------|
| GitHub 项目 | 150+ 个 `self-improving` / `self-evolving` 标签项目 |
| 竞品深度分析 | Hermes Agent、GenericAgent、Evolver、SICA、EvoAgentX、GBrain |
| 前端设计范式 | Agentic UI Patterns 2026、AgentOS 迁移趋势、共治演化模式 |
| 记忆系统 | Mem0、Hindsight、Letta、Zep/Graphiti、Cognee 等 8 大框架 |
| Agent 框架 | LangGraph、CrewAI、AutoGen、LlamaIndex、Agno 等 15 个框架 |

---

## 二、核心项目深度分析

### 2.1 GenericAgent — 最激进的自我进化（⭐4.3K，每日 +883）

**GitHub**: https://github.com/lsdefine/GenericAgent

**核心创新**: 整个仓库由 Agent 自己编写。388 个 commit 中没有一个是人类手动输入。

| 特性 | 说明 |
|------|------|
| **技能决定化（Skill Crystallization）** | 首次探索 → 成功路径 → 结晶为可复用技能 → 6x token 节省 |
| **5 层记忆架构** | L0 元规则 → L1 路由索引 → L2 全局事实 → L3 任务技能 → L4 会话归档 |
| **3.3K 行种子代码** | 9 个原子工具 + ~100 行 Agent 循环，其余全靠自我进化 |
| **真实浏览器注入** | 非沙盒，保持登录会话 |
| **Android ADB** | 通过 ADB 控制手机设备 |

#### 5 层记忆架构详解

| 层级 | 名称 | 角色 |
|------|------|------|
| L0 | Meta Rules | 核心行为约束（不可变） |
| L1 | Insight Index | 路由和召回索引（最小注入层） |
| L2 | Global Facts | 长期运营中积累的稳定知识 |
| L3 | Task Skills/SOPs | 可复用的工作流程 |
| L4 | Session Archive | 完成的会话蒸馏记录 |

**关键洞察**: L1 作为路由层，确保"只注入需要的知识"，这是 30K 上下文窗口就能运行的核心原因（竞品需要 200K-1M tokens）。

#### 技能决定化流程

```
新任务 → 自主探索（安装依赖、编写脚本、调试验证）
       → 执行路径结晶为 Skill
       → 存入 L3 记忆层
       → 类似任务出现时直接复用（token 消耗降低 6x）
```

**对 llm-wiki-agent 的借鉴价值**:
- `reflect.py` 已在做技能决定化，但缺少 **token 效率追踪**
- MEMORY.md 可升级为 **5 层架构**

---

### 2.2 Evolver — 基因进化协议（⭐4.7K，每日 +866）

**GitHub**: https://github.com/EvoMap/evolver

**核心创新**: 不直接修改 prompt，而是通过"基因"和"胶囊"进行结构化进化。

#### GEP（Genome Evolution Protocol）资产结构

```
assets/gep/
├── genes.json      # 原子进化模式（可复用的改进单元）
├── capsules.json   # 复合进化策略（基因组合）
└── events.jsonl    # 可审计的进化日志（追加专用）
```

#### 进化工作流

```
信号检测（分析运行时日志中的错误模式）
→ 基因选择（信号匹配算法评分相关进化资产）
→ 变异生成（受控的变异对象）
→ Prompt 发射（协议化 prompt，非随意修改）
→ 事件记录（追加到 events.jsonl，可审计）
```

**对 llm-wiki-agent 的借鉴价值**:
- `self_optimize.py` 已记录优化历史到 `optimize_history.jsonl`，与 Evolver 的 `events.jsonl` 思路一致
- 可引入 **基因/胶囊概念**：将成功的优化模式提取为可复用的"进化资产"

---

### 2.3 Hermes Agent — 最成熟的通用自主 Agent（⭐133K）

**GitHub**: https://github.com/NousResearch/hermes-agent

**最新版本**: v0.13.0 "The Tenacity Release"（2026-05-09）

#### v0.13.0 核心新特性

| 特性 | 说明 |
|------|------|
| **Kanban 多 Agent 系统** | 共享看板、任务分配、心跳检测、僵尸检测、任务恢复 |
| **持久化目标（/goal）** | 目标跨会话持久，自动恢复中断的任务 |
| **Checkpoints v2** | 会话自动保存，崩溃后无缝恢复 |
| **插件化 Provider** | LLM 提供商改为插件架构 |
| **8 个 P0 安全修复** | 严重安全问题修复 |

#### Hermes 4 层自我改善机制

| 层 | 阶段 | 说明 |
|----|------|------|
| 1 | 任务执行 | 按计划执行工具调用 |
| 2 | 回顾（Skill Generation） | 任务完成后自动提取可复用技能 |
| 3 | 技能改善（Self-Refinement） | 基于 DSPy + GEPA 进化式 prompt 优化 |
| 4 | 记忆持久化与检索 | FTS5 搜索 + LLM 摘要 + Honcho 用户建模 |

#### Hermes 生态前端项目

| 项目 | Stars | 技术栈 | 核心功能 |
|------|-------|--------|---------|
| hermes-web-ui | 1.8K | Vue3 + TypeScript + Naive UI + Pinia | 多平台管理面板、会话管理、使用分析 |
| hermes-workspace | 2.8K | 原生 Web | 终端模拟 + 文件浏览 + 对话界面 |
| Hermes 官方 Web UI | 内置 | React + Vite + FastAPI | 配置管理、会话检查、分析仪表盘 |

#### hermes-web-ui 核心功能分析

- **实时会话检查**: 点击任何活跃或历史聊天，查看完整消息历史（含时间戳、通道元数据、模型推理日志）
- **定时任务编辑器**: 创建/暂停/克隆/回填任务，查看最近 5 次执行日志
- **通道配置仪表盘**: 切换 webhook 端点、调整重试策略、设置速率限制
- **使用分析**: 按通道/模型提供商/prompt 模板分解

**对 llm-wiki-agent 的借鉴价值**:
- Kanban 多 Agent 看板 → 可用于 JarvisPage 的任务管理
- 持久化目标 + Checkpoints → 已有的 Goal 系统可增强
- hermes-web-ui 的会话检查模式 → 可用于 Agent 执行历史回放

---

### 2.4 SICA — 代码自修改 Agent

**论文**: arXiv:2504.15228 | **GitHub**: https://github.com/MaximeRobeyns/self_improving_coding_agent

**核心创新**: Agent 可以编辑自己的代码库来提升性能，在 SWE-Bench Verified 上提升 17%-53%。

**关键发现**:
- 消除了"元 Agent"和"目标 Agent"的区分 —— 只有一个 Agent，既是执行者也是优化者
- 非梯度学习机制：通过 LLM 反思和代码更新驱动
- 标准 Python 实现，无领域特定语言

**对 llm-wiki-agent 的借鉴价值**:
- 工具脚本（`tools/*.py`）理论上可通过类似机制自我优化
- 需要严格的安全门控（L0-L4 风险等级系统已提供基础）

---

### 2.5 其他值得关注的项目

| 项目 | Stars | 核心价值 | 借鉴方向 |
|------|-------|---------|---------|
| **singularity-claude** | — | Claude Code 的自进化技能引擎 | 技能自我创建/评分/修复的递归循环 |
| **metabot** | 736 | 飞书/Telegram 运行 Claude Code | 共享记忆 + Agent 工厂 + 定时任务 |
| **CORAL** | 644 | 多 Agent 自主自进化基础设施 | 轻量级多 Agent 自进化框架 |
| **ReflexioAI** | 148 | 从真实用户交互中持续学习 | Agent 自改进框架 |
| **Mem0** | 48K | 最流行的 Agent 记忆框架 | 向量 + 图谱双存储架构 |
| **Hindsight** | 4K | 为机构知识设计的混合记忆系统 | 多策略混合记忆检索 |
| **Letta** | 21K | 操作系统启发的分层记忆 | 分层记忆 + 状态持久化 |

---

## 三、自我进化机制技术实现对比

### 3.1 进化范式分类

| 范式 | 代表项目 | 进化粒度 | 复杂度 |
|------|---------|---------|--------|
| **参数自适应** | llm-wiki-agent (Learner) | 系统阈值 | 中 |
| **技能决定化** | GenericAgent、Hermes | 可复用技能 | 中高 |
| **基因进化协议** | Evolver | 进化资产 | 高 |
| **Prompt 自优化** | EvoAgentX | Agent 提示词 | 中高 |
| **代码自修改** | SICA | Agent 代码 | 很高 |
| **目标分解 + 工具编排** | llm-wiki-agent (Planner)、Hermes | 任务计划 | 中 |
| **多 Agent 种群进化** | EvoAgentX PopulationFlow | Agent 变体 | 很高 |
| **自主循环决策** | GBrain-OpenClaw | 全栈 | 很高 |

### 3.2 记忆系统架构对比

| 框架 | 架构 | 记忆类型 | 开源 |
|------|------|---------|------|
| **GenericAgent** | 5 层（L0-L4） | 元规则 + 路由 + 事实 + 技能 + 归档 | MIT |
| **Mem0** | 向量 + 图谱双存储 | 个性化 + 机构知识 | Apache 2.0 |
| **Letta** | 分层（OS 启发） | 个性化 + 机构知识 | Apache 2.0 |
| **Zep/Graphiti** | 时序知识图谱 | 时序感知记忆 | Graphiti 开源 |
| **Hindsight** | 多策略混合 | 机构知识优先 | MIT |
| **llm-wiki-agent** | PostgreSQL + MEMORY.md | 结构化 wiki + 反思记忆 | — |

### 3.3 进化可审计性对比

| 项目 | 审计机制 | 存储格式 |
|------|---------|---------|
| **Evolver** | events.jsonl（追加专用） | JSONL |
| **llm-wiki-agent** | optimize_history.jsonl + jarvis_tool_stats | JSONL + PostgreSQL |
| **GenericAgent** | L4 Session Archive | Markdown |
| **Hermes** | 无系统化审计 | 内存 |

---

## 四、2026 前端交互范式迁移

### 4.1 三次范式跃迁

根据 2026 年行业分析：

| 范式 | 用户角色 | Agent 角色 | 代表 |
|------|---------|-----------|------|
| **指令驱动** | 主导流程 | 被动执行器 | 传统 CLI/GUI |
| **目标导向** | 声明意图 | 自主规划路径 | ChatGPT、当前 JarvisPage |
| **共治演化** | 共享状态空间 | 实时协商策略、校准信任边界 | 2026 最前沿 |

### 4.2 Agentic UI 核心设计模式（2026）

#### 协作模型

| 模型 | 模式 | 适用场景 |
|------|------|---------|
| **Human-in-the-Loop** | Agent 处理常规工作，不确定/高风险时停止请求审批 | 内容审核、财务审批 |
| **Human-on-the-Loop** | Agent 自主运行，人类通过仪表盘监控 | 自动交易、基础设施管理 |
| **Delegation** | 用户提供目标，Agent 自主执行 | 研究助手、项目规划 |

#### 信任建设模式

| 模式 | 实现 |
|------|------|
| **置信度指示器** | 高(>90%)=绿色实线自动执行、中(70-90%)=黄色虚线标注执行、低(<70%)=红色点线请求输入 |
| **推理链披露** | 展示决策原因、证据来源、替代方案 |
| **渐进式能力披露** | 能力分层展示，避免信息过载 |
| **执行历史追踪** | 展示成功完成率、错误处理记录 |

#### 环境 Agent 模式

```
Agent 在后台持续运行
  ├── 流式更新到仪表盘
  ├── 仅在关键事件时通知
  └── 用户始终拥有覆盖控制权
```

### 4.3 ChatUI → AgentOS 迁移的关键技术

| 技术 | 说明 |
|------|------|
| **流式 Token 渲染** | 按 LLM 输出 token 批次动态调整 UI 更新粒度 |
| **可解释性交互协议** | 嵌入 WebSocket 消息流，前端解析为带置信度滑块的对话卡片 |
| **跨模态事件对齐** | 统一时间戳归一化 + 跨模态锚点对齐 |
| **Recipe 驱动的动态 UI** | 从静态页面设计转向可组合行为的 recipe 系统 |

---

## 五、你的项目现状评估

### 5.1 自我进化能力矩阵

| 能力维度 | llm-wiki-agent | Hermes | GenericAgent | Evolver | SICA |
|----------|---------------|--------|-------------|---------|------|
| 技能决定化 | ✅ reflect.py | ✅ SKILL.md | ✅ 5 层记忆 | ❌ | ❌ |
| 参数自适应 | ✅ Learner | ❌ | ❌ | ✅ GEP | ❌ |
| 目标分解 | ✅ Planner | ✅ LangGraph | ❌ | ❌ | ❌ |
| 知识编译 | ✅ ingest.py | ❌ | ❌ | ❌ | ❌ |
| 知识图谱 | ✅ vis.js+Louvain | ❌ | ❌ | ❌ | ❌ |
| 矛盾检测 | ✅ lint.py | ❌ | ❌ | ❌ | ❌ |
| 代码自修改 | ❌ | ❌ | ❌ | ❌ | ✅ |
| 跨会话记忆 | ✅ PostgreSQL | ⚠️ 有限 | ✅ 5 层 | ✅ events.jsonl | ❌ |
| 风险分级 | ✅ L0-L4 | ❌ | ❌ | ❌ | ❌ |
| 进化可审计 | ✅ jsonl | ❌ | ❌ | ✅ events.jsonl | ❌ |
| 前端交互 | ⚠️ 赛博朋克只读 | ✅ 对话式 | ⚠️ Streamlit | ❌ | ❌ |

### 5.2 独特优势（其他所有项目都不具备的组合）

1. **知识编译 + 自我进化** — 唯一在 ingest 时编译知识，并在编译过程中自我进化的系统
2. **结构化知识 + 图谱可视化** — 唯一有交互式知识图谱的 wiki 系统
3. **矛盾检测 + 风险分级** — 唯一能检测知识矛盾并按风险等级分级处理的系统
4. **CRDT 协同编辑** — 唯一支持实时协同编辑的 AI 知识管理系统

### 5.3 核心短板

1. **前端交互是最大短板** — JarvisPage 是赛博朋克风格的只读面板，缺少"共治演化"交互
2. **缺少 token 效率追踪** — GenericAgent 的核心卖点是 6x token 节省，你没有量化数据
3. **记忆架构可升级** — 当前 MEMORY.md 是扁平结构，可升级为 GenericAgent 的 5 层架构
4. **进化资产不可复用** — 优化模式记录在 jsonl 中但未提取为可复用的"基因/胶囊"

### 5.4 已有的前端组件清单

| 路由 | 组件 | 当前状态 |
|------|------|---------|
| `/` | HomePage | ✅ 完整 |
| `/browse` | BrowsePage | ✅ 完整 |
| `/search` | SearchPage | ⚠️ 孤岛，不连接 Jarvis |
| `/graph` | GraphPage | ⚠️ 缺少内搜索和演化动画 |
| `/dashboard` | DashboardPage | ⚠️ 缺少学习指标 |
| `/mindmap/:slug` | MindmapPage | ⚠️ 只读 |
| `/timeline` | TimelinePage | ✅ 完整 |
| `/jarvis` | JarvisPage | ⚠️ 只读面板，缺少交互 |
| `/skills` | SkillsPage | ⚠️ 缺少评分和进化历史 |
| `/approvals` | ApprovalsPage | ⚠️ 未连接后端审批流 |
| `/agent-log` | AgentLogPage | ✅ 完整 |

---

## 六、前端升级方案

### 6.1 Phase 1: 核心交互补齐（1-2 周）

#### 6.1.1 置信度可视化

**文件**: `wiki-viewer/src/components/jarvis/ExecutionPanel.tsx`

为每个执行步骤添加置信度条：

| 置信度 | 颜色 | 边框 | 动作 |
|--------|------|------|------|
| >90% | 绿色 (#00FF41) | 实线 | 自动执行 |
| 70-90% | 黄色 (#FFB000) | 虚线 | 执行并标注 |
| <70% | 红色 (#FF3860) | 点线 | 请求人工输入 |

数据来源: `Learner` 的 `confidence` 字段已存在，前端仅需渲染。

#### 6.1.2 推理链透明化

**文件**: `wiki-viewer/src/components/jarvis/ExecutionPanel.tsx`

在每个步骤下方展示 Agent 的推理过程：

```
┌─────────────────────────────────────────────┐
│  Step 3: 刷新来源 X                          │
│  置信度: ████████░░ 82%                      │
│                                              │
│  推理链:                                      │
│  1. 检测到源文件 hash 变更                     │
│  2. 上次刷新距今 14 天                        │
│  3. 相关页面数量: 3                           │
│                                              │
│  替代方案: [跳过此源] [仅刷新变更部分]         │
└─────────────────────────────────────────────┘
```

数据来源: SSE `reflection` 事件已有，需扩展为结构化推理链。

#### 6.1.3 进化历史面板

**文件**: `wiki-viewer/src/components/pages/JarvisPage.tsx`

新增 Tab 展示 `state/optimize_history.jsonl`：

```
[Day 1]  health  | 空文件检测: 2 个
[Day 1]  heal    | 自动生成: EntityA.md, EntityB.md
[Day 3]  lint    | 断链检测: 3 处 → 自动修复: 2 处
[Day 3]  graph   | 社区数: 5 → 6（新增 "Safety" 社区）
[Day 7]  refresh | 过期源: sources/paper-a.md（hash 变更）
```

API 端点: 新增 `GET /api/jarvis/optimize-history`，读取 `state/optimize_history.jsonl`。

#### 6.1.4 技能评分展示

**文件**: `wiki-viewer/src/components/pages/SkillsPage.tsx`

为每个技能卡片添加指标：

| 指标 | 数据来源 | 展示方式 |
|------|---------|---------|
| 使用次数 | `jarvis_tool_stats.call_count` | 数字徽章 |
| 成功率 | `jarvis_tool_stats.success_count / call_count` | 百分比 + 颜色 |
| 平均耗时 | `jarvis_tool_stats.avg_duration_ms` | 毫秒 |
| Token 节省率 | `reflect.py` 输出的 `skill_suggestion` | 百分比趋势图 |

---

### 6.2 Phase 2: 共治演化界面（2-4 周）

#### 6.2.1 看板视图（Kanban Board）

**新增文件**: `wiki-viewer/src/components/jarvis/KanbanBoard.tsx`

参考 Hermes v0.13.0 的 Kanban 多 Agent 系统：

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│   待处理      │   进行中      │   等待审批    │   已完成      │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ Ingest       │ Refresh      │ Delete       │ Health Check │
│ paper-c.md   │ paper-a.md   │ orphan-X.md  │ ✅ 0 issues  │
│              │ ▓▓▓░░ 60%    │ ⚠️ L3 风险   │              │
│ Heal         │              │              │ Graph Build  │
│ EntityC.md   │              │              │ ✅ 6 社区     │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

功能清单：
- 任务拖拽（yjs CRDT 已引入）
- 心跳检测（Agent 存活状态）
- 任务恢复（中断后自动重新分配）
- 僵尸检测（无响应任务自动清理）

数据来源: `jarvis_loop.py` 的 `StepStatus` 枚举（PENDING/RUNNING/COMPLETED/FAILED/SKIPPED/AWAITING_APPROVAL）。

#### 6.2.2 进化时间线（Evolution Timeline）

**新增文件**: `wiki-viewer/src/components/jarvis/EvolutionTimeline.tsx`

参考 EvoAgentX 的 `EvolutionTimeline.tsx`：

```
2026-05-01 ─── 首次摄入论文 A
  ├── 反思: 发现实体链接模式
  ├── 技能建议: auto-link-entities (confidence: 0.78)
  └── 记忆更新: 新增 3 个实体页面

2026-05-03 ─── 自动优化阈值
  ├── 调整: concurrency.default 3 → 4
  ├── 原因: 连续 5 次完美成功率
  └── 安全等级: SAFE（自动应用）

2026-05-07 ─── 摄入论文 B
  ├── 复用: auto-link-entities 技能
  ├── 效果: token 消耗降低 40%
  └── 进化: 技能评分 0.78 → 0.85
```

数据来源: `state/optimize_history.jsonl` + `wiki/.agent/MEMORY.md`。

#### 6.2.3 知识图谱内搜索

**文件**: `wiki-viewer/src/components/pages/GraphPage.tsx`

功能：
- 搜索框输入关键词 → 高亮匹配节点 + 最短路径
- 点击节点 → 侧边栏展示页面摘要、出入边数量、社区归属
- 搜索结果列表 → 点击跳转到对应 wiki 页面

技术方案: vis-network 的 `selectNodes()` + `focus()` API + networkx 最短路径算法。

#### 6.2.4 图谱演化动画

**文件**: `wiki-viewer/src/components/pages/GraphPage.tsx`

功能：
- 时间轴滑块：从 wiki 创建日期到今天
- 拖动滑块 → 图谱逐步展示节点和边的增长
- 关键帧标注：ingest 事件、社区分裂/合并事件

技术方案: 基于 `graph.json` 的 `built` 时间戳 + `log.md` 的 ingest 记录生成时间序列快照。

---

### 6.3 Phase 3: 完整共治演化（1-2 月）

#### 6.3.1 多 Agent 协作可视化

参考 Hermes v0.13.0 Kanban + metabot 的 Agent 工厂：

- 多 Agent 并行执行面板（3 个子 Agent 并发）
- Agent 间通信可视化（消息流图）
- 任务依赖 DAG 可视化

#### 6.3.2 进化资产编辑器

参考 Evolver 的 GEP 协议：

- 可视化查看/编辑"基因"（原子进化模式）
- 可视化查看/编辑"胶囊"（复合进化策略）
- 进化日志浏览器（events.jsonl 时间线）

#### 6.3.3 实时协同编辑

利用已引入的 yjs CRDT：

- 多人同时编辑同一 wiki 页面
- 光标位置实时同步
- 冲突自动解决（CRDT 保证）

#### 6.3.4 Dashboard 增强

新增"学习指标"卡片：

| 指标 | 说明 |
|------|------|
| 本周新增技能数 | reflect.py 输出的 skill_suggestion 计数 |
| 记忆更新次数 | MEMORY.md 变更频率 |
| 矛盾检测数 | lint.py 输出的 contradictions 计数 |
| token 效率趋势 | ingest/query 的 token 消耗变化 |
| 知识增长趋势 | 页面数/边数/社区数的时间序列 |
| 图谱连通性 | 平均度/聚类系数/孤立节点比例 |

---

## 七、实现优先级路线图

### 7.1 三阶段路线图

```
Phase 1 (1-2 周)                Phase 2 (2-4 周)               Phase 3 (1-2 月)
┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐
│ 置信度可视化       │           │ 看板视图          │           │ 多 Agent 可视化   │
│ 推理链透明化       │    →      │ 进化时间线         │    →      │ 进化资产编辑器    │
│ 进化历史面板       │           │ 图谱内搜索         │           │ 实时协同编辑      │
│ 技能评分展示       │           │ 图谱演化动画       │           │ Dashboard 增强    │
└──────────────────┘           └──────────────────┘           └──────────────────┘
     打通交互                      共治演化                       完整体验
```

### 7.2 依赖关系

| 任务 | 前置依赖 | 可并行 |
|------|---------|--------|
| 置信度可视化 | 无 | ✅ |
| 推理链透明化 | SSE 协议扩展 | ✅ |
| 进化历史面板 | API 端点 | ✅ |
| 技能评分展示 | 无 | ✅ |
| 看板视图 | Phase 1 完成 | ❌ |
| 进化时间线 | Phase 1 完成 | ✅ |
| 图谱内搜索 | 无 | ✅ |
| 图谱演化动画 | log.md 解析 | ❌ |

### 7.3 技术栈确认

| 层 | 技术 | 已引入 |
|----|------|--------|
| 框架 | React 18 + TypeScript + Vite | ✅ |
| 状态管理 | Zustand | ✅ |
| 样式 | TailwindCSS 4 + CSS Variables | ✅ |
| 动画 | Framer Motion | ✅ |
| 图谱 | vis-network/standalone | ✅ |
| 协同 | yjs CRDT | ✅ |
| 国际化 | i18next (en + zh-CN) | ✅ |
| 路由 | react-router-dom v6 | ✅ |
| 懒加载 | React.lazy + Suspense | ✅ |

**所有前端升级方案均基于已引入的技术栈，无需新增依赖。**

---

## 八、差异化竞争策略

### 8.1 定位

> **The wiki that compiles knowledge once and compounds forever — with a living knowledge graph and a self-improving agent.**

### 8.2 与竞品的互补关系

| 竞品 | 擅长 | 与你的关系 |
|------|------|-----------|
| **Hermes Agent** | 通用自主 Agent、调度、通信 | 互补：Hermes 通过 MCP 调用你的知识能力 |
| **GenericAgent** | 浏览器/手机自动化、技能决定化 | 借鉴：5 层记忆架构 |
| **Evolver** | 基因进化协议 | 借鉴：进化资产概念 |
| **Mem0** | Agent 个性化记忆 | 互补：你的结构化知识 vs 它的个性化记忆 |
| **Obsidian+Plugins** | 生态最大 | 竞争：你有 AI Agent + 自动 ingest |

### 8.3 护城河

1. **知识编译范式** — ingest 时编译，查询零 LLM 调用（成本效率极高）
2. **结构化四层分类** — entity/concept/source/synthesis（Hermes 只有扁平 MEMORY）
3. **知识图谱可视化** — vis.js + Louvain 社区检测（全球唯一有可视化的 wiki）
4. **矛盾检测** — 跨页面矛盾自动标记（无竞品具备）
5. **风险分级安全** — L0-L4 + 人工审批门控（Hermes 无此机制）
6. **进化可审计** — 每个优化步骤记录在 jsonl（Hermes 无系统化审计）

### 8.4 变现路径

```
个人免费版                     团队版 ($15-25/月/用户)
├── 开源仓库自部署              ├── 托管服务
├── 基础 ingest/query/health    ├── 团队协作 + 权限管理
├── 本地 LLM 支持               ├── 多源自动 ingest
└── 社区支持                    ├── 高级知识图谱分析
                                ├── SSO + 审计日志
                                └── 优先支持

企业版 ($2000+/年/团队)
├── 私有部署
├── 自定义 Agent 工具
├── 与内部系统集成 (Slack, Confluence, etc.)
└── SLA + 专属支持
```

---

## 附录 A: 关键参考链接

| 资源 | URL |
|------|-----|
| GenericAgent | https://github.com/lsdefine/GenericAgent |
| Evolver | https://github.com/EvoMap/evolver |
| Hermes Agent | https://github.com/NousResearch/hermes-agent |
| hermes-web-ui | https://github.com/EKKOLearnAI/hermes-web-ui |
| SICA 论文 | https://arxiv.org/abs/2504.15228 |
| Awesome Self-Evolving Agents | https://github.com/EvoAgentX/Awesome-Self-Evolving-Agents |
| Agentic UI Patterns 2026 | https://www.maviklabs.com/blog/agentic-ui-patterns-2026 |
| ChatUI to AgentOS | https://blog.csdn.net/CodePulse/article/details/160113376 |
| Best Agent Memory Systems 2026 | https://vectorize.io/articles/best-ai-agent-memory-systems |
| Mem0 | https://github.com/mem0ai/mem0 |
| singularity-claude | https://github.com/shmayro/singularity-claude |
| metabot | https://github.com/xvirobotics/metabot |
| CORAL | https://github.com/Human-Agent-Society/CORAL |
| ReflexioAI | https://github.com/ReflexioAI/reflexio |

## 附录 B: 项目内相关文档索引

| 文档 | 路径 |
|------|------|
| 自我优化计划 | `docs/plan/self-optimization-plan.md` |
| Jarvis 进化计划 | `docs/plan/jarvis-evolution-plan.md` |
| Hermes 分析（5 轮） | `docs/plan/hermes-agent-analysis-5-iterations.md` |
| 竞品分析 2025 | `docs/competitive-analysis-2025.md` |
| 竞品格局 2026 更新 | `docs/competitive-landscape-2026-update.md` |
| 跨域整合头脑风暴 | `docs/cross-domain-integration-brainstorm.md` |
| 自优化执行计划 | `docs/plan/self-optimization-execution-plan.md` |
