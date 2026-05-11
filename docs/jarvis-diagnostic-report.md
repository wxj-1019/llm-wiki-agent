# Jarvis 系统诊断报告

> **生成日期**: 2026-05-11  
> **修订日期**: 2026-05-11（v2 — 反映 Search 页重构 + Jarvis 功能页规划）  
> **修订日期**: 2026-05-11（v3 — 新增行业对标分析 + 自我进化路线图）  
> **修订日期**: 2026-05-11（v4 — 深度迭代：后端状态机深度分析、风险评估、数据库 Schema、API 契约、可观测性方案）  
> **审计范围**: 前端 Search/Chat UI、JarvisPage 仪表盘、后端 API 端点、MCP Server、Jarvis Agent 框架、LLM 调用基础设施  
> **行业对标**: Hermes Agent (NousResearch)、EvoAgentX、Suna.so、R2E-V2、OpenManus  
> **结论**: 后端 Jarvis Agent 框架成熟（40+ 工具、完整自主循环），前端已完成架构分离——Search 页专注知识库检索，但 Jarvis Agent 缺少一个可交互的功能页面来承载目标输入、执行监控和结果反馈。对标行业领先项目，Jarvis 在自我进化（Skill 闭环、工作流进化、跨会话记忆）方面存在显著提升空间。

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [系统架构总览](#2-系统架构总览)
3. [后端审计：AI Chat 端点](#3-后端审计ai-chat-端点)
4. [后端审计：LLM 调用基础设施](#4-后端审计llm-调用基础设施)
5. [后端审计：MCP Server](#5-后端审计mcp-server)
6. [后端审计：Jarvis 自主 Agent 框架](#6-后端审计jarvis-自主-agent-框架)
7. [前端审计：Search 页知识检索链路](#7-前端审计search-页知识检索链路)
8. [前端审计：JarvisPage 仪表盘现状](#8-前端审计jarvispage-仪表盘现状)
9. [核心断层分析](#9-核心断层分析)
10. [诊断检查清单](#10-诊断检查清单)
11. [改进路线图：Jarvis 功能页建设](#11-改进路线图jarvis-功能页建设)
12. [行业对标分析：自我进化 Agent 架构参考](#12-行业对标分析自我进化-agent-架构参考)

---

## 1. 执行摘要

本次审计覆盖了 LLM Wiki Agent 的全部核心链路，并根据最新的前端架构重构进行了修订。

**架构现状**：项目已明确分离两大前端职责：

| 前端页面 | 路由 | 定位 | 状态 |
|----------|------|------|------|
| **Search 页** | `/search` | 知识库检索中枢（搜索 + AI 问答 + Skill/MCP 生成） | ✅ 已完成重构，3-Tab 架构 |
| **Jarvis 页** | `/jarvis` | Agent 仪表盘（只读状态 + 启停控制） | ⚠️ 只读面板，无法交互 |

**后端能力矩阵**：

| 系统 | 位置 | 能力 | 状态 |
|------|------|------|------|
| **Jarvis Agent 框架** | `tools/jarvis/` (18 模块, 40+ 工具) | 完整自主代理循环 | ✅ 仅 CLI 可用 |
| **MCP Server** | `tools/mcp_server.py` (5 工具) | 外部客户端调用 | ✅ 但前端不走 MCP |
| **AI Chat 端点** | `api_server.py` `/api/chat` | 纯文本 RAG 对话 | ✅ Search 页在用 |

**核心瓶颈**：后端 Jarvis Agent 框架功能完备，但缺少面向前端的 API 端点和 SSE 流式回传——JarvisPage 无法让用户输入目标、实时观看 Agent 执行过程。

---

## 2. 系统架构总览

### 2.1 当前架构（职责分离 + 断层状态）

```
┌──────────────────────────────────────────────────────────────────┐
│                    前端页面层                                      │
│                                                                   │
│  ┌─────────────────────────────────┐  ┌────────────────────────┐ │
│  │         Search 页 (/search)     │  │  Jarvis 页 (/jarvis)   │ │
│  │                                 │  │                        │ │
│  │  3-Tab 架构:                    │  │  只读仪表盘:            │ │
│  │  ├─ Search Results (FTS5/语义)  │  │  ├─ Agent Status 面板   │ │
│  │  ├─ AI Chat (RAG 对话)         │  │  ├─ Registered Tools    │ │
│  │  └─ Generate (Skill/MCP 导出)  │  │  ├─ Recent Events      │ │
│  │                                 │  │  ├─ Current Goals      │ │
│  │  ✅ 知识库全文搜索              │  │  ├─ Learning Summary   │ │
│  │  ✅ RAG 对话 + 来源引用        │  │  └─ Start/Stop/Pause   │ │
│  │  ✅ Skill/MCP 包生成           │  │                        │ │
│  │  ❌ 无 Tool Calling            │  │  ❌ 无目标输入          │ │
│  │  ❌ 无 Agent Loop              │  │  ❌ 无实时执行展示      │ │
│  │  ❌ 不连接 Jarvis              │  │  ❌ 无结果反馈          │ │
│  │                                 │  │  ❌ 不连接 Jarvis Loop │ │
│  └──────────┬──────────────────────┘  └───────────┬────────────┘ │
│             │                                      │              │
└─────────────┼──────────────────────────────────────┼──────────────┘
              │                                      │
         🔴 断层 ①                           🔴 断层 ②
      Search 页是孤岛                     JarvisPage 是纯只读面板
              │                                      │
┌─────────────┴──────────────────────────────────────┴──────────────┐
│                    后端服务层                                       │
│                                                                    │
│  ┌──────────────────────┐  ┌────────────────────────────────────┐ │
│  │  api_server.py        │  │  Jarvis Agent 框架                 │ │
│  │  ├─ /api/chat         │  │  tools/jarvis/ (18 模块, 40+ 工具) │ │
│  │  ├─ /api/chat/stream  │  │                                    │ │
│  │  ├─ /api/wiki-chat    │  │  ✅ Goal→Plan→Execute→Reflect→Learn│ │
│  │  ├─ /api/jarvis/*     │  │  ✅ 6 种规划策略                    │ │
│  │  │  (status/tools/    │  │  ✅ 40+ 注册工具                   │ │
│  │  │   events/goals/    │  │  ✅ 安全守卫 + 审批门控             │ │
│  │  │   start/stop/pause)│  │  ✅ 经验学习 + 多代理协作           │ │
│  │  └─ ❌ 无 /api/agent  │  │                                    │ │
│  │     /chat 端点        │  │  入口: CLI only                    │ │
│  │                       │  │  ❌ 无 REST/SSE API                │ │
│  │  ✅ 纯 RAG 对话可用   │  │  ❌ 无法被前端调用                  │ │
│  │  ❌ 不支持 tool calling│  └────────────────────────────────────┘ │
│  └──────────────────────┘                                          │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  MCP Server (tools/mcp_server.py)                              ││
│  │  ✅ 5 个 MCP 工具  ✅ 供外部客户端调用  ❌ 前端不走 MCP       ││
│  └────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 目标架构（Jarvis 功能页独立建设）

```
┌──────────────────────────────────────────────────────────────────┐
│                    前端页面层                                      │
│                                                                   │
│  ┌────────────────────────────┐  ┌──────────────────────────────┐│
│  │   Search 页 (/search)      │  │   Jarvis 页 (/jarvis)        ││
│  │   (保持现状，不做改动)      │  │   (升级为功能页)              ││
│  │                            │  │                              ││
│  │   ├─ Search Results        │  │   ┌──────────────────────┐   ││
│  │   ├─ AI Chat (RAG 对话)   │  │   │ 目标输入区            │   ││
│  │   └─ Generate              │  │   │ "分析孤立页面并修复"  │   ││
│  │                            │  │   └──────────┬───────────┘   ││
│  │   职责：知识检索            │  │              │              ││
│  │   不变：纯 RAG，不连 Jarvis │  │              ▼              ││
│  └────────────────────────────┘  │   ┌──────────────────────┐   ││
│                                  │   │ 实时执行面板 (SSE)    │   ││
│                                  │   │ ├─ Plan 卡片          │   ││
│                                  │   │ ├─ Tool Call 进度条   │   ││
│                                  │   │ ├─ Tool Result 折叠   │   ││
│                                  │   │ ├─ Reflection 标注    │   ││
│                                  │   │ └─ 最终总结           │   ││
│                                  │   └──────────────────────┘   ││
│                                  │                              ││
│                                  │   保留: 状态面板 + 学习摘要  ││
│                                  │   (作为页签或侧边栏)          ││
│                                  └──────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    后端服务层                                      │
│                                                                   │
│  ┌────────────────────────────────────────┐                      │
│  │  新增: /api/agent/chat (SSE)           │                      │
│  │  ├─ 接收用户目标 (description)         │                      │
│  │  ├─ 启动 Jarvis AgentLoop              │                      │
│  │  └─ SSE 流式回传:                      │                      │
│  │     ├─ type: "plan"                    │                      │
│  │     ├─ type: "step_start"              │                      │
│  │     ├─ type: "tool_call"               │                      │
│  │     ├─ type: "tool_result"             │                      │
│  │     ├─ type: "reflection"              │                      │
│  │     ├─ type: "content"                 │                      │
│  │     └─ type: "done"                    │                      │
│  └──────────────┬─────────────────────────┘                      │
│                 │ 桥接                                             │
│                 ▼                                                  │
│  ┌──────────────────────────────────────┐                        │
│  │  Jarvis AgentLoop (已有)             │                        │
│  │  Goal → Plan → Execute → Reflect     │                        │
│  │  → Learn → Done                      │                        │
│  └──────────────────────────────────────┘                        │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 架构设计原则

| 原则 | 说明 |
|------|------|
| **职责分离** | Search 页 = 知识检索入口；Jarvis 页 = 自主 Agent 操作台。两者独立，不互相侵入 |
| **Search 页不改** | 已完成 3-Tab 重构，保持稳定。RAG 对话仍然走 `/api/wiki-chat`，不引入工具调用复杂度 |
| **Jarvis 页独立建设** | 基于现有 JarvisPage.tsx 升级，新增目标输入 + 实时执行展示 + 结果反馈，通过 `/api/agent/chat` SSE 连接后端 AgentLoop |
| **后端单点扩展** | 只需新增一个 `/api/agent/chat` SSE 端点，桥接前端和 Jarvis AgentLoop |

---

## 3. 后端审计：AI Chat 端点

### 3.1 端点总览

`api_server.py` 中共存在 **3 个 chat 端点**：

| 端点 | 方法 | 行号 | 用途 |
|------|------|------|------|
| `/api/chat` | POST | L1624-L1713 | 前端 AI Chat 对话（支持非流式 + 流式） |
| `/api/chat/stream` | POST | L1715-L1798 | SSE 流式专用端点 |
| `/api/agent-kit/llm-chat` | POST | L1810-L1861 | Agent Kit 的 LLM 辅助对话 |

**不存在** `/api/wiki/chat`、`/api/generate` 等其他 chat 端点。

### 3.2 `/api/chat` 端点实现分析

**关键代码路径**：`tools/api_server.py` L1624-L1713

```python
class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: str | None = None
    system_prompt: str = ""
    temperature: float = 0.7
    max_tokens: int = 2048
    stream: bool = False

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    # 构建消息列表
    full_messages = []
    if request.system_prompt:
        full_messages.append({"role": "system", "content": request.system_prompt})
    for msg in request.messages:
        full_messages.append({"role": msg.role, "content": msg.content or ""})

    # 调用 LLM — 纯文本 completion，无 tools 参数
    kwargs = {
        "model": model,
        "messages": full_messages,
        "max_tokens": request.max_tokens,
        "temperature": request.temperature,
    }
    if api_key:
        kwargs["api_key"] = api_key

    # 流式 / 非流式分支...
```

**诊断结论**：

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 是否支持 Function/Tool Calling？ | ❌ 不支持 | `kwargs` 中只有 `model`、`messages`、`max_tokens`、`temperature`、`api_key`，**从未传入 `tools` 参数** |
| 是否有多轮工具调用循环？ | ❌ 不支持 | 一次性调用：收到 messages → 调用 LLM → 返回 response |
| 默认 System Prompt？ | ❌ 无 | system prompt 完全由前端传入，不传则无 |
| SSE 流式支持？ | ✅ 有 | `/api/chat` 设置 `stream: true` 或专用 `/api/chat/stream` 端点 |
| Wiki 上下文注入？ | ❌ 端点不注入 | 上下文由前端负责组装，后端只是透传给 LLM |

### 3.3 SSE 流式协议

```
data: {"type": "content", "content": "token..."}\n\n
data: {"type": "content", "content": "token..."}\n\n
...
data: {"type": "done"}\n\n
```

错误时：
```
data: {"type": "error", "error": "错误信息"}\n\n
```

**注意**：SSE 协议中 **没有** `tool_calls`、`function_call`、`action` 等事件类型。

### 3.4 辅助：LLM 回退方案

当 `litellm` 不可用时，`_fallback_llm_call()` 支持直接使用 Anthropic/OpenAI SDK：
- Anthropic Claude：通过 `anthropic` 包直接调用
- OpenAI GPT：通过 `openai` 包直接调用
- 其他模型：不支持回退

---

## 4. 后端审计：LLM 调用基础设施

### 4.1 `tools/shared/llm.py` — `call_llm()` 函数

**关键路径**：`tools/shared/llm.py` L303-L390

```python
def call_llm(
    prompt: str,
    model_env: str = "LLM_MODEL",
    default_model: str = "claude-3-5-sonnet-latest",
    max_tokens: int = 4096,
    max_retries: int = 2,
    timeout: int = 120,
    system: str = "",
    temperature: float | None = None,
) -> str:  # ← 返回值是纯 str
```

**生产级特性**：

| 特性 | 说明 |
|------|------|
| 配置驱动 | 从 `config/llm.yaml` 加载模型、provider、API key，环境变量覆盖 |
| 重试机制 | 最多 `max_retries` 次重试，指数退避 |
| 熔断器 | `LLMCircuitBreaker` 连续失败 5 次触发熔断，60 秒后恢复 |
| 预算追踪 | `LLMBudgetTracker` 按日/月 token 消耗和费用限额控制 |
| 结构化日志 | 每次请求记录 model、elapsed、tokens、attempt |

**关键缺陷**：

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 支持 Function Calling？ | ❌ 不支持 | 返回值是 `str`，无 `tools` 参数 |
| 支持多模态输入？ | ❌ 不支持 | 只接受纯文本 `prompt: str` |

---

## 5. 后端审计：MCP Server

### 5.1 暴露的 MCP 工具

**文件**：`tools/mcp_server.py`

| 工具名 | 行号 | 功能 | 风险 |
|--------|------|------|------|
| `wiki_search` | L334-L357 | FTS5 全文搜索 wiki 内容 | 低 |
| `wiki_read` | L360-L387 | 按名称读取单个 wiki 页面 | 低 |
| `wiki_write` | L390-L407 | 创建或更新 wiki 页面 | 高（需 `JARVIS_SAFE_MODE=false`） |
| `wiki_list` | L410-L428 | 列出所有 wiki 页面，支持按类型过滤 | 低 |
| `wiki_ingest` | L431-L455 | 将源文件吸收到 wiki | 高（调用子进程） |

### 5.2 MCP Resources

- `wiki://pages` — 所有 wiki 页面列表
- `wiki://page/{name}` — 单个页面内容

### 5.3 诊断结论

MCP Server 设计为供 **外部客户端**（Claude Desktop、Cursor、VS Code）通过 stdio 协议调用。前端 Chat UI **不走 MCP 协议**，而是直接调用 `/api/chat` REST 端点。

---

## 6. 后端审计：Jarvis 自主 Agent 框架

### 6.1 框架结构

**位置**：`tools/jarvis/` — 18 个模块 + 7 个工具子模块

#### 核心框架模块

| 文件 | 功能 |
|------|------|
| `types.py` | 核心类型系统：`RiskLevel`（L0-L5）、`ToolCategory`（7 类）、`ToolSpec`、`ToolResult`、`AgentGoal`/`GoalStatus`、`Event`/`EventCategory`、`PlanStep`/`Plan`、`ApprovalRule`/`ApprovalPolicy` |
| `config.py` | 配置系统，从 `config/jarvis.yaml` 加载，支持环境变量覆盖 |
| `loop.py` | **核心自治循环** — `AgentLoop`：Goal→Plan→Execute→Reflect→Learn 完整循环 |
| `planner.py` | 规划系统：6 种策略（QuickFix/DeepResearch/Maintenance/Emergency/Checkpoint/Adaptive） |
| `tool_registry.py` | 工具注册中心：`ToolRegistry` 单例 — 动态工具注册/发现/执行 |
| `state.py` | 持久化状态管理：PostgreSQL 存储 checkpoints、completed steps、goal history |
| `approval.py` | 审批系统：L2+ 风险工具需要人类批准 |
| `safety.py` | 安全守卫：路径穿越检测、频率限制、破坏性操作确认、注入防护 |
| `learner.py` | 经验学习：从失败中学习并推荐修复策略 |

#### 高级子系统

| 文件 | 功能 |
|------|------|
| `goals.py` | 目标管理：状态机（PENDING→PLANNING→EXECUTING→SUCCEEDED/FAILED） |
| `strategies.py` | 策略接口：抽象基类 + 4 种具体策略 |
| `event_bus.py` | 事件总线：进程内 pub/sub，PostgreSQL 持久化 |
| `multi_agent.py` | 多代理协作：角色分配（researcher/coder/reviewer/planner） |
| `self_diagnose.py` | 自诊断：死锁检测、内存使用、数据库健康 |
| `audit.py` | 审计日志：PostgreSQL `jarvis_audit` 表 |
| `voice.py` | 语音接口：ASR（Whisper）和 TTS |
| `plugin_market.py` | 插件市场：远程插件搜索/安装/更新 |
| `jarvis_pg.py` | 数据库连接池管理 |

### 6.2 注册工具清单（40+ 个）

#### 知识管理工具（`knowledge_tools.py`）

| 工具 | 功能 |
|------|------|
| `wiki_search` | 搜索 wiki 页面 |
| `wiki_read` | 读取 wiki 页面 |
| `wiki_write` | 写入 wiki 页面 |
| `ingest` | 摄入源文档 |
| `wiki_query` | 查询 wiki 知识 |
| `health_check` | 健康检查 |
| `lint` | 内容质量检查 |
| `heal` | 自动修复缺失页面 |
| `build_graph` | 构建知识图谱 |
| `quality_score` | 质量评分 |

#### 系统操作工具（`system_tools.py`）

| 工具 | 功能 |
|------|------|
| `shell_exec` | 执行 Shell 命令 |
| `git_status` | Git 状态查看 |
| `git_commit` | Git 提交 |
| `python_eval` | Python 表达式求值 |
| `http_get` | HTTP GET 请求 |
| `file_write` | 文件写入 |

#### 网络工具（`web_tools.py`）

| 工具 | 功能 |
|------|------|
| `web_search` | 网络搜索 |
| `web_fetch` | 网页抓取 |

#### 开发工具（`dev_tools.py`）

| 工具 | 功能 |
|------|------|
| `run_tests` | 运行测试 |
| `lint_code` | 代码 lint |
| `pylint_check` | pylint 检查 |
| `type_check` | 类型检查 |
| `format_code` | 代码格式化 |
| `dependency_check` | 依赖检查 |

#### 通信工具（`comm_tools.py`）

| 工具 | 功能 |
|------|------|
| `notify_desktop` | 桌面通知 |
| `notify_log` | 日志通知 |
| `schedule_task` | 任务调度 |
| `schedule_reminder` | 提醒调度 |
| `email_send` | 邮件发送 |
| `webhook_notify` | Webhook 通知 |

#### 组合工具（`composite_tools.py`）

| 工具 | 功能 |
|------|------|
| `full_ingest_pipeline` | 完整摄入流水线 |
| `maintenance_cycle` | 维护周期 |
| `research_topic` | 主题研究 |
| `daily_report` | 日报生成 |

#### MCP 客户端工具（`mcp_client.py`）

| 工具 | 功能 |
|------|------|
| `mcp_list_servers` | 列出 MCP 服务器 |
| `mcp_start_server` | 启动 MCP 服务器 |
| `mcp_stop_server` | 停止 MCP 服务器 |
| `mcp_call_tool` | 调用 MCP 工具 |
| `mcp_list_tools` | 列出 MCP 工具 |

### 6.3 自主循环核心流程

```python
# tools/jarvis/loop.py — AgentLoop.run()

async def run(self) -> GoalStatus:
    # Phase 0: 可行性检查
    is_feasible, blocked_reasons = self.planner.check_impossible_checklist(...)

    # Phase 1: 构建初始计划
    await self._build_initial_plan()

    # Phase 2: 执行循环
    while self.goal.status == GoalStatus.EXECUTING:
        step = self._select_next_step()        # 选择下一步
        if self._should_replan():              # 检查是否需要重规划
            await self._replan("failure_threshold")
        tool_name = self._select_tool(step)    # 选择工具
        result = await self._execute_tool(step, tool_name)  # 执行
        if self._step_count % 3 == 0:          # 每 3 步反思
            await self._reflection_step()

    # Phase 3: 总结
    await self._celebrate_step()
    return self.goal.status
```

### 6.4 CLI 入口

```bash
# 启动自主 Agent
python tools/jarvis_cli.py run "分析 wiki 中的孤立页面并修复"

# 列出可用工具
python tools/jarvis_cli.py tools
```

---

## 7. 前端审计：Search 页知识检索链路

### 7.1 Search 页重构概况

Search 页已完成 3-Tab 架构重构，职责明确为**知识库内容检索中枢**：

| Tab | 组件 | 职责 |
|-----|------|------|
| **Search Results** | `SearchResultsTab.tsx` | FTS5 全文搜索 + 语义搜索结果展示 |
| **AI Chat** | `ChatTab.tsx` | 基于知识库上下文的 RAG 对话 |
| **Generate** | `GenerateTab.tsx` | 从对话内容生成 Skill/MCP 包 |

**文件结构**：

```
wiki-viewer/src/components/search/
├── types.ts              # 共享类型定义
├── HighlightText.tsx     # 搜索高亮组件
├── SearchResultsTab.tsx  # 搜索结果 Tab
├── ChatTab.tsx           # AI 对话 Tab
└── GenerateTab.tsx       # 生成 Tab
```

### 7.2 AI Chat 数据流

```
用户输入 → SearchPage.handleChatSend()
  → chatWithWikiStream() (chatService.ts)
    → POST /api/wiki-chat (SSE)
      → 后端 LLM completion (纯文本，无 tools 参数)
        → SSE chunks 返回
          → ChatTab 渲染 Markdown
```

### 7.3 `chatService.ts` 接口

```typescript
export interface WikiChatMessage {
  role: 'user' | 'assistant';
  content: string;          // 纯文本，无 tool_calls
}

export interface WikiChatChunk {
  chunk?: string;
  sources?: WikiChatSource[];
  status?: string;
  error?: string;
  done?: boolean;
}
```

### 7.4 Search 页定位诊断

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 知识检索能力？ | ✅ 完整 | FTS5 + Ollama 语义搜索，支持去重和高亮 |
| RAG 对话能力？ | ✅ 完整 | 基于知识库上下文的回答 + 来源引用 |
| Skill/MCP 生成？ | ✅ 完整 | 从对话结果生成可部署的 Skill 和 MCP Server 包 |
| 支持 Tool Calling？ | ❌ 不支持 | 设计上不属于 Search 页职责 |
| 连接 Jarvis Agent？ | ❌ 不连接 | Search 页专注知识检索，不承担 Agent 交互 |

**结论**：Search 页作为知识检索中枢已完备，**无需改动**。Agent 交互应由独立的 Jarvis 功能页承担。

---

## 8. 前端审计：JarvisPage 仪表盘现状

### 8.1 现有 JarvisPage 分析

**文件**：`wiki-viewer/src/components/pages/JarvisPage.tsx`（468 行）

JarvisPage 当前是一个**纯只读仪表盘**，通过轮询（10 秒间隔）获取后端状态数据。

#### 数据来源

| API 端点 | 数据 | 用途 |
|----------|------|------|
| `GET /api/jarvis/status` | Agent 状态、cycle 计数、成功率 | 状态面板 |
| `GET /api/jarvis/tools` | 已注册工具列表 | 工具展示 |
| `GET /api/jarvis/events?limit=10` | 最近事件流 | 事件列表 |
| `GET /api/jarvis/goals` | 当前目标及进度 | 目标面板 |
| `GET /api/jarvis/learning` | 学习摘要、模式、置信度 | 学习面板 |

#### 用户操作能力

| 操作 | 端点 | 说明 |
|------|------|------|
| Start | `POST /api/jarvis/start` | 启动 Agent |
| Stop | `POST /api/jarvis/stop` | 停止 Agent |
| Pause | `POST /api/jarvis/pause` | 暂停 Agent |

### 8.2 JarvisPage 缺失能力

```
当前 JarvisPage 可以做到：
  ✅ 显示 Agent 运行状态 (running/paused/stopped)
  ✅ 显示已注册工具列表 (40+ 工具)
  ✅ 显示最近事件流 (10 条)
  ✅ 显示当前目标及进度条
  ✅ 显示学习摘要和模式
  ✅ 启动/暂停/停止控制
  ✅ 10 秒轮询自动刷新

当前 JarvisPage 无法做到：
  ❌ 输入目标 — 没有文本输入框让用户描述任务
  ❌ 发送目标 — 没有 API 端点接收用户目标并启动 AgentLoop
  ❌ 实时执行展示 — 无法展示 Agent 的 Plan → Execute → Reflect 过程
  ❌ 工具调用监控 — 无法实时显示哪个工具正在执行、结果如何
  ❌ 执行历史回放 — 无法查看历史目标的完整执行过程
  ❌ 结果反馈 — 无法展示 Agent 完成任务后的总结和建议
  ❌ 确认审批 — 无法在前端审批高风险工具执行 (L2+)
```

### 8.3 与后端 Jarvis 框架的能力差距

| 后端能力 | 对应模块 | 前端能否使用？ | 差距 |
|----------|----------|----------------|------|
| 目标输入 → AgentLoop | `loop.py` | ❌ | 无输入 UI，无 API 端点 |
| 6 种规划策略 | `planner.py` | ❌ | 策略选择在后端完成，前端不可见 |
| 40+ 工具执行 | `tool_registry.py` | ❌ | 工具仅展示列表，无法监控执行 |
| 安全审批 (L2+) | `approval.py` / `safety.py` | ❌ | 无前端审批 UI |
| 事件总线 | `event_bus.py` | ⚠️ 部分 | 仅轮询 `/api/jarvis/events`，非实时 |
| 经验学习 | `learner.py` | ⚠️ 部分 | 仅展示摘要，无法参与反馈 |
| 多代理协作 | `multi_agent.py` | ❌ | 无多代理进度展示 |
| 语音交互 | `voice.py` | ❌ | 无前端集成 |

### 8.4 全局搜索验证

在 `wiki-viewer/src/` 中搜索以下模式，确认前端无任何 Agent 交互逻辑：

| 搜索模式 | 结果 |
|----------|------|
| `parseCommand` / `parseAction` / `handleAction` | 无结果 |
| `executeAction` / `agentLoop` / `runAgent` | 无结果 |
| `json.*block` / `structured.*response` | 无结果 |
| `tool_calls` | 仅在 JarvisPage.tsx 中作为状态数据显示（只读） |
| `/api/agent` | 无结果 |

---

## 9. 核心断层分析

### 断层总览

```
┌─────────────────────────────────────────────────────────────┐
│                     断层分布图                               │
│                                                              │
│  Search 页 (/search)          Jarvis 页 (/jarvis)           │
│  ┌──────────────┐             ┌──────────────────┐          │
│  │ RAG 对话 ✅  │             │ 只读仪表盘 ⚠️    │          │
│  │ 知识检索 ✅  │             │ Start/Stop ✅     │          │
│  │ 生成导出 ✅  │             │ 事件轮询 ⚠️      │          │
│  └──────┬───────┘             └────────┬─────────┘          │
│         │                              │                     │
│    (不需连接)                    🔴 断层 ①                   │
│    Search 页已是               无目标输入 UI                  │
│    完整闭环                      ↓                          │
│                              🔴 断层 ②                      │
│                              无 /api/agent/chat 端点         │
│                                ↓                           │
│                              🔴 断层 ③                      │
│                              无 SSE 实时执行回传             │
│                                ↓                           │
│                              🔴 断层 ④                      │
│                              无前端审批 UI                   │
│                                ↓                           │
│  ┌─────────────────────────────────────────────────┐       │
│  │         Jarvis Agent 框架 (tools/jarvis/)        │       │
│  │         40+ 工具 · 完整自主循环 · CLI only       │       │
│  └─────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### 断层 ①：JarvisPage 缺少目标输入能力

**现状**：
```
JarvisPage.tsx (468 行)
  ├─ 5 个 GET 轮询端点 (status/tools/events/goals/learning)
  ├─ 3 个 POST 操作 (start/stop/pause)
  └─ ❌ 无目标输入 UI
  └─ ❌ 无 "提交目标" 按钮
  └─ ❌ 无策略选择器
```

**影响**：用户打开 Jarvis 页，只能看到 Agent 的状态仪表盘，却无法告诉 Jarvis "去做什么"。这是最基础的功能缺失——一个操作台没有键盘。

### 断层 ②：后端缺少 `/api/agent/chat` SSE 端点

**现状**：
```
api_server.py 已有:
  ├─ /api/chat          → 纯 RAG 对话 (Search 页在用)
  ├─ /api/chat/stream   → SSE 流式文本
  ├─ /api/wiki-chat     → 知识库增强对话
  └─ /api/jarvis/*      → 状态查询 + 启停控制

api_server.py 缺少:
  └─ ❌ /api/agent/chat  → 接收目标 → 启动 AgentLoop → SSE 流式回传执行过程
```

**影响**：即使前端有目标输入框，也无法将目标发送给后端的 Jarvis AgentLoop 执行。这是前后端连接的核心管道缺失。

### 断层 ③：Agent 执行过程无法实时回传

**现状**：
```
Jarvis AgentLoop.run() 内部:
  ├─ _build_initial_plan()  → Plan 对象 (内存中)
  ├─ _select_next_step()    → PlanStep (内存中)
  ├─ _execute_tool()        → ToolResult (内存中)
  ├─ _reflection_step()     → 反思文本 (内存中)
  └─ event_bus.emit()       → Event (PostgreSQL，非前端)

前端:
  └─ GET /api/jarvis/events?limit=10  → 轮询获取历史事件 (10秒间隔)
  └─ ❌ 无 SSE/WebSocket 实时推送
  └─ ❌ 无法区分 "正在执行" vs "已执行完成"
```

**影响**：Jarvis 执行一个复杂任务可能需要 30 秒到几分钟，期间前端无法显示当前正在执行哪个步骤、调用了什么工具、结果如何。用户体验为"提交后黑屏等待"。

### 断层 ④：高风险工具执行无前端审批

**现状**：
```
后端 safety.py:
  ├─ L0-L1: 自动执行
  ├─ L2-L3: 需要人类批准 → approval.py (CLI 交互)
  └─ L4-L5: 需要人工确认 (CLI stdin)

前端:
  └─ ❌ 无审批对话框
  └─ ❌ 无风险等级展示
  └─ ❌ 无法批准/拒绝高风险操作
```

**影响**：高风险工具（如 `shell_exec`、`git_commit`、`file_write`）在 Web 环境下无法被审批，AgentLoop 会被阻塞或跳过这些步骤。

---

## 10. 诊断检查清单

### 10.1 Search 页（知识检索）— 不需改动

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 1 | FTS5 全文搜索？ | ✅ | `SearchResultsTab` 支持高亮命中 |
| 2 | 语义搜索？ | ✅ | Ollama 嵌入 + 混合搜索 |
| 3 | RAG 对话？ | ✅ | `ChatTab` 通过 `/api/wiki-chat` 增强对话 |
| 4 | 来源引用？ | ✅ | AI 回复附带 `sources` 可点击导航 |
| 5 | Skill/MCP 生成？ | ✅ | `GenerateTab` 3 阶段进度 |
| 6 | 3-Tab 架构？ | ✅ | Results / AI Chat / Generate |
| 7 | URL 参数同步？ | ✅ | `?tab=chat` `?tab=generate` 双向同步 |
| 8 | 组件拆分？ | ✅ | 575 行拆为 4 个子组件 + types.ts |

**结论**：Search 页功能完备，无需改动。

### 10.2 Jarvis 页（自主 Agent）— 需要建设

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 1 | 目标输入 UI？ | ❌ | JarvisPage.tsx 无文本输入框 |
| 2 | 策略选择器？ | ❌ | 无法选择 QuickFix / DeepResearch 等规划策略 |
| 3 | `/api/agent/chat` SSE 端点？ | ❌ | api_server.py 中不存在此端点 |
| 4 | AgentLoop → SSE 桥接？ | ❌ | AgentLoop 输出到内存/DB，不输出到 SSE 流 |
| 5 | Plan 展示组件？ | ❌ | 无法展示 Agent 分解出的执行计划 |
| 6 | Tool Call 实时进度？ | ❌ | 无法实时显示工具调用过程 |
| 7 | Tool Result 折叠展示？ | ❌ | 无法展示工具执行结果 |
| 8 | Reflection 标注？ | ❌ | 无法展示 Agent 的反思过程 |
| 9 | 高风险工具审批 UI？ | ❌ | 无法在前端审批 L2+ 工具执行 |
| 10 | 执行历史回放？ | ❌ | 无法查看历史目标的完整执行链 |
| 11 | 状态仪表盘？ | ✅ | 已有 AgentStatus/Tools/Events/Goals/Learning 面板 |
| 12 | Agent 启停控制？ | ✅ | 已有 Start/Stop/Pause 按钮 |
| 13 | 工具列表展示？ | ✅ | 已有 40+ 工具分类展示 |
| 14 | 事件轮询？ | ⚠️ | 10 秒间隔，非实时 |

**结论**：仪表盘基础已具备，但核心交互能力（目标输入 → 执行监控 → 结果反馈）全部缺失。

### 10.3 后端基础设施

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 1 | Jarvis AgentLoop 完整？ | ✅ | Goal→Plan→Execute→Reflect→Learn |
| 2 | 40+ 注册工具可用？ | ✅ | 7 类工具全部注册 |
| 3 | 安全守卫？ | ✅ | 路径穿越检测、频率限制、注入防护 |
| 4 | 审批门控？ | ✅ (CLI) | L2+ 需人类批准，但仅 CLI 交互 |
| 5 | 事件总线？ | ✅ | 进程内 pub/sub + PostgreSQL 持久化 |
| 6 | `call_llm()` 支持 tool calling？ | ❌ | 返回 `str`，无 `tools` 参数 |
| 7 | `/api/chat` 支持 tool calling？ | ❌ | 纯 `litellm.completion()` |
| 8 | MCP Server 可用？ | ✅ | 5 工具供外部客户端 |

---

## 11. 改进路线图：Jarvis 功能页建设

### 总体策略

```
原则：Search 页不动，Jarvis 页独立升级

Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
后端 API      前端功能页     审批与安全     高级特性
(管道打通)    (交互能力)     (生产就绪)     (体验优化)
```

---

### Phase 1：后端 Agent API 管道（解决断层 ②）

**目标**：创建 `/api/agent/chat` SSE 端点，连接前端和 Jarvis AgentLoop。

| 任务 | 说明 | 涉及文件 | 解决断层 |
|------|------|----------|----------|
| 1.1 创建 `/api/agent/chat` SSE 端点 | 接收 `{ description, strategy?, options? }`，启动 AgentLoop，返回 SSE 事件流 | `tools/api_server.py` | ② |
| 1.2 设计 SSE 事件协议 | 定义 7 种事件类型：`plan` / `step_start` / `tool_call` / `tool_result` / `reflection` / `content` / `done` / `error` | `tools/api_server.py` | ③ |
| 1.3 AgentLoop → SSE 桥接 | 在 AgentLoop 执行过程中注入 SSE 回调，将每个阶段的状态实时写入 EventSourceResponse | `tools/jarvis/loop.py` | ③ |
| 1.4 审批事件 SSE 回传 | 当 AgentLoop 遇到 L2+ 工具时，通过 SSE 发送 `approval_required` 事件，等待前端响应 | `tools/jarvis/approval.py` | ④ |
| 1.5 安全模式 Web 策略 | Web 端默认 `JARVIS_SAFE_MODE=true`，高风险工具需用户确认后才执行 | `tools/jarvis/safety.py` | ④ |

#### SSE 事件协议设计

```typescript
// 前端解析的 SSE 事件类型
interface AgentSSEEvent {
  type: 'plan'            // Agent 分解出的执行计划
      | 'step_start'      // 开始执行某个步骤
      | 'tool_call'       // 调用某个工具（名称、参数摘要）
      | 'tool_result'     // 工具执行结果（成功/失败、摘要）
      | 'reflection'      // Agent 反思（每 3 步一次）
      | 'approval_required' // 需要用户审批高风险操作
      | 'content'         // Agent 最终回答/总结
      | 'done'            // 执行完成
      | 'error';          // 错误
  data: Record<string, unknown>;
}
```

**验收标准**：
- `curl -N /api/agent/chat -d '{"description":"列出孤立页面"}'` 能收到完整 SSE 事件流
- AgentLoop 每个阶段都有对应 SSE 事件输出

---

### Phase 2：Jarvis 功能页前端建设（解决断层 ①③）

**目标**：基于现有 JarvisPage.tsx 升级，新增目标输入 + 实时执行展示。

#### 2.1 页面布局重构

```
┌────────────────────────────────────────────────────────────┐
│  Jarvis                                    [Dashboard Tab] │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  目标输入区                                             │ │
│  │  ┌───────────────────────────────────┐ ┌────────────┐  │ │
│  │  │ 输入你的目标...                     │ │  策略 ▾    │  │ │
│  │  │ "分析 wiki 中的孤立页面并修复"      │ │ [提交 ▶]  │  │ │
│  │  └───────────────────────────────────┘ └────────────┘  │ │
│  │  快捷目标: [健康检查] [修复孤立页面] [构建知识图谱]     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  实时执行面板                                           │ │
│  │                                                         │ │
│  │  📋 执行计划                                            │ │
│  │  ├─ ✅ Step 1: 扫描 wiki 目录结构                       │ │
│  │  ├─ 🔄 Step 2: 调用 wiki_search 搜索孤立页面  ← 当前   │ │
│  │  └─ ⬜ Step 3: 对孤立页面生成修复建议                   │ │
│  │                                                         │ │
│  │  🔧 工具调用                                            │ │
│  │  ├─ ✅ wiki_search("orphan") → 找到 5 个孤立页面        │ │
│  │  └─ 🔄 wiki_read("OrphanPage.md") → 读取中...          │ │
│  │                                                         │ │
│  │  💭 反思                                                │ │
│  │  └─ "发现 5 个孤立页面，其中 3 个缺少反向链接"          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────┐ ┌────────────────────────────┐   │
│  │  Agent Status         │ │  Learning Summary          │   │
│  │  (现有面板，保留)      │ │  (现有面板，保留)           │   │
│  └──────────────────────┘ └────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

#### 2.2 前端任务清单

| 任务 | 说明 | 涉及文件 | 解决断层 |
|------|------|----------|----------|
| 2.1 目标输入组件 | 文本输入框 + 策略下拉选择器 + 提交按钮 | `wiki-viewer/src/components/jarvis/GoalInput.tsx` | ① |
| 2.2 快捷目标按钮 | 预设常见目标（健康检查、修复孤立、构建图谱等） | `wiki-viewer/src/components/jarvis/GoalInput.tsx` | ① |
| 2.3 agentService.ts | SSE 客户端，连接 `/api/agent/chat`，解析 7 种事件类型 | `wiki-viewer/src/services/agentService.ts` | ② |
| 2.4 实时执行面板 | 展示 Plan 卡片列表 + 当前执行步骤高亮 | `wiki-viewer/src/components/jarvis/ExecutionPanel.tsx` | ③ |
| 2.5 工具调用卡片 | 展示工具名称、参数摘要、执行状态（成功/失败/进行中） | `wiki-viewer/src/components/jarvis/ToolCallCard.tsx` | ③ |
| 2.6 反思标注 | 展示 Agent 的反思文本，附在对应步骤下方 | `wiki-viewer/src/components/jarvis/ReflectionNote.tsx` | ③ |
| 2.7 最终总结区 | 展示 Agent 完成任务后的 content 回答 | `wiki-viewer/src/components/jarvis/GoalSummary.tsx` | ③ |
| 2.8 JarvisPage 重构 | 将现有 468 行单文件拆分为：目标输入 + 执行面板 + 侧边状态栏 | `wiki-viewer/src/components/pages/JarvisPage.tsx` | ①③ |

**验收标准**：
- 用户在输入框输入 "列出孤立页面"，点击提交，实时看到 Agent 的执行过程
- 执行完成后显示总结结果

---

### Phase 3：审批与安全（解决断层 ④）

**目标**：实现高风险工具的前端审批流程。

| 任务 | 说明 | 涉及文件 |
|------|------|----------|
| 3.1 审批对话框组件 | 当收到 `approval_required` 事件时，弹出审批弹窗 | `wiki-viewer/src/components/jarvis/ApprovalDialog.tsx` |
| 3.2 风险等级可视化 | 工具卡片上显示风险等级标签（L0 绿 → L5 红） | `wiki-viewer/src/components/jarvis/ToolCallCard.tsx` |
| 3.3 审批 SSE 双向通信 | 前端通过单独的 POST 端点发送 approve/reject 响应 | `tools/api_server.py` + `agentService.ts` |
| 3.4 审批超时处理 | 用户 30 秒内未响应 → 自动拒绝 + 通知 | `tools/jarvis/approval.py` |

**验收标准**：
- Agent 调用 `shell_exec` (L3) 时，前端弹出审批对话框
- 用户点击"批准"或"拒绝"后，Agent 继续或跳过该步骤

---

### Phase 4：高级特性

| 任务 | 说明 | 涉及文件 |
|------|------|----------|
| 4.1 执行历史面板 | 查询 `/api/jarvis/goals` 历史，展示已完成目标的执行过程回放 | `wiki-viewer/src/components/jarvis/GoalHistory.tsx` |
| 4.2 多代理协作展示 | 展示 researcher/coder/reviewer 的角色分工和协作过程 | `wiki-viewer/src/components/jarvis/MultiAgentView.tsx` |
| 4.3 学习反馈 | 用户对 Agent 结果评价（👍/👎），反馈到 `learner.py` | `wiki-viewer/src/components/jarvis/LearningFeedback.tsx` |
| 4.4 语音输入 | 集成 Jarvis `voice.py` 的 ASR 能力，支持语音下达目标 | `wiki-viewer/src/components/jarvis/VoiceInput.tsx` |
| 4.5 Dashboard Tab | 将现有仪表盘（Status/Tools/Events/Goals/Learning）移入 Dashboard 子页签 | `JarvisPage.tsx` 布局调整 |

---

### 实施优先级

```
紧急且重要 ──────────────────────────────────────── 重要但不紧急

  Phase 1 (后端)           Phase 2 (前端)          Phase 3 (安全)    Phase 4 (高级)
  ┌──────────────┐    ┌───────────────────┐    ┌───────────┐    ┌───────────┐
  │ 1.1 SSE 端点  │    │ 2.1 目标输入组件   │    │ 3.1 审批UI │    │ 4.1 历史  │
  │ 1.2 事件协议  │ →  │ 2.3 agentService  │ →  │ 3.2 风险标 │ →  │ 4.2 多代理│
  │ 1.3 Loop桥接  │    │ 2.4 执行面板      │    │ 3.3 双向SSE│    │ 4.3 反馈  │
  │ 1.4 审批事件  │    │ 2.8 Page 重构     │    │ 3.4 超时   │    │ 4.4 语音  │
  └──────────────┘    └───────────────────┘    └───────────┘    └───────────┘
     后端单点扩展          前端功能页建设           生产就绪          体验优化
```

### 技术决策记录

| ADR | 决策 | 理由 |
|-----|------|------|
| ADR-1 | Search 页和 Jarvis 页职责分离，不互相侵入 | Search 页已完成重构且功能完备，不应引入 Agent 复杂度 |
| ADR-2 | Jarvis 页基于现有 JarvisPage.tsx 升级而非新建 | 已有仪表盘基础（状态/工具/事件/目标/学习），复用可节省 60% 工作量 |
| ADR-3 | 后端只需新增一个 `/api/agent/chat` SSE 端点 | AgentLoop 已有完整实现，只需桥接 SSE 输出，无需重构后端 |
| ADR-4 | 使用 SSE 而非 WebSocket | 与现有 Search 页的 `/api/wiki-chat` SSE 方案一致，架构统一 |
| ADR-5 | 审批通过 POST 端点而非 SSE 双向流 | SSE 是单向的，审批响应走单独 POST 更简单可靠 |
| ADR-6 | 自我进化采用 Skill 闭环模式 | 参考 Hermes Agent 的 autonomous skill creation，每次任务完成自动提取可复用 Skill |
| ADR-7 | 内存分层：短期(执行上下文) + 长期(Skill/Pattern) | 参考 EvoAgentX 的 ephemeral + persistent memory 双层架构 |
| ADR-8 | 工作流自动构建采用 LLM 生成 + 人工审核 | 参考 EvoAgentX 的 WorkFlowGenerator，从自然语言目标自动构建多 Agent 工作流 |

---

## 12. 行业对标分析：自我进化 Agent 架构参考

> 本节对标 GitHub 上具有自我优化、自我进化能力的多功能 Agent 项目，提炼可借鉴的架构模式，为 Jarvis 的长期演进提供参考。

### 12.1 对标项目概览

| 项目 | Stars | 核心特征 | 自我进化机制 |
|------|-------|----------|-------------|
| **Hermes Agent** (NousResearch) | 4k+ | 全能型自主 Agent，多平台网关 | Skill 自主创建 + 使用中自我改进 + 经验记忆闭环 |
| **EvoAgentX** | 5k+ | 自我进化的 Agent 工作流框架 | 工作流自动构建 + 评估反馈 + 迭代优化 |
| **Suna.so** (Kortix) | 14.4k | 通用型 AI Agent | 自然语言 → 任务分解 → 工具执行 → 结果反馈 |
| **R2E-V2** (Agent-Evals) | 143 | 700 个软件工程 Agent 基准 | Agent 评估 + 能力量化 + 跨任务泛化 |
| **OpenManus** | 27k+ | 多工具通用 Agent | 工具链编排 + 自主规划 |

### 12.2 关键架构模式提炼

#### 模式 A：闭环学习循环（Hermes Agent）

```
用户任务 → Agent 执行 → 任务完成
                ↓
        Skill 自主提取 ← 复杂任务自动沉淀为可复用 Skill
                ↓
        Skill 使用中改进 ← 执行 Skill 时自动优化步骤
                ↓
        经验记忆持久化 ← FTS5 索引 + LLM 摘要
                ↓
        跨会话召回 ← 下次类似任务自动匹配历史经验
```

**Jarvis 现状对比**：

| 能力 | Hermes Agent | Jarvis |
|------|-------------|--------|
| Skill 自主创建 | ✅ 任务完成后自动提取 | ❌ 仅有 `skill_engine.py` 执行引擎 |
| Skill 自我改进 | ✅ 使用中优化 | ❌ Skill 是静态模板 |
| 经验记忆 | ✅ FTS5 + LLM 摘要 + Honcho 用户建模 | ⚠️ `learner.py` 有基础学习，但无 Skill 闭环 |
| 跨会话召回 | ✅ 全文搜索 + 语义匹配 | ❌ 每次执行独立，无历史经验利用 |
| 定时任务 | ✅ 内置 cron 调度器 | ⚠️ `scheduler.py` 仅限 fetcher 管道 |

**借鉴方向**：Jarvis 的 `learner.py` 已有学习基础，需要增加"任务完成 → Skill 自动提取 → Skill 持久化 → 下次自动调用"的闭环。

#### 模式 B：工作流自动构建 + 自我进化（EvoAgentX）

```
自然语言目标
      ↓
WorkFlowGenerator（LLM 驱动）
      ↓
自动生成多 Agent 工作流图
      ↓
AgentManager 分配角色 + 工具
      ↓
WorkFlow.execute() 执行
      ↓
Evaluator 自动评估结果
      ↓
EvolutionEngine 迭代优化工作流
      ↓
下一轮执行（更优的工作流）
```

**Jarvis 现状对比**：

| 能力 | EvoAgentX | Jarvis |
|------|-----------|--------|
| 工作流自动构建 | ✅ 从自然语言生成多 Agent 工作流 | ⚠️ `planner.py` 有 6 种策略，但是固定的 |
| 自动评估 | ✅ 内置 Evaluator 评分 | ⚠️ `evaluator.py` 有评估，但不驱动进化 |
| 工作流进化 | ✅ EvolutionEngine 迭代优化 | ❌ 计划执行后不回流优化策略 |
| HITL 检查点 | ✅ 人类可在关键节点介入 | ⚠️ `approval.py` 仅限安全审批 |
| 工作流可视化 | ✅ `workflow_graph.display()` | ❌ 无执行流程可视化 |

**借鉴方向**：Jarvis 的 `planner.py` 可以从固定策略升级为"策略生成 → 执行 → 评估 → 进化"循环。每次执行后，评估器评分结果，进化引擎根据评分调整规划策略。

#### 模式 C：多平台网关 + Web 管理面板（Hermes Agent）

```
单一 Agent 核心
      │
      ├── CLI TUI（终端交互）
      ├── Telegram Bot
      ├── Discord Bot
      ├── Slack Bot
      ├── WhatsApp Bot
      ├── Signal Bot
      ├── Web UI Dashboard（管理面板）
      └── MCP Server（外部客户端）
```

**Jarvis 现状对比**：

| 接入方式 | Hermes Agent | Jarvis |
|----------|-------------|--------|
| CLI | ✅ 完整 TUI | ✅ `jarvis_cli.py` |
| Web UI | ✅ 管理面板 | ⚠️ 只读仪表盘（需升级） |
| 消息平台 | ✅ 7+ 平台 | ❌ 无 |
| MCP Server | ✅ | ✅ `mcp_server.py` |
| 定时任务 | ✅ cron + 平台推送 | ⚠️ 仅 fetcher 管道 |

**借鉴方向**：Web UI 是最优先的前端接入点（即 Phase 2 的 Jarvis 功能页）。消息平台集成可作为远期目标。

### 12.3 Jarvis 差距矩阵

| 维度 | 行业标杆 | Jarvis 现状 | 差距等级 | 优先级 |
|------|----------|-------------|----------|--------|
| **自主执行** | 目标输入 → 自动规划 → 工具执行 → 反思 | 后端完整，前端不可用 | 🔴 关键 | P0 |
| **实时反馈** | SSE/WebSocket 实时展示执行过程 | 前端仅 10s 轮询 | 🔴 关键 | P0 |
| **Skill 闭环** | 任务完成 → 自动提取 Skill → 持久化 → 复用 | 无 Skill 自动提取 | 🟡 重要 | P1 |
| **工作流进化** | 执行 → 评估 → 优化策略 → 再执行 | 评估器不驱动进化 | 🟡 重要 | P1 |
| **跨会话记忆** | FTS5 索引 + 语义匹配 + 用户建模 | 基础 learner，无跨会话 | 🟡 重要 | P1 |
| **工作流可视化** | 执行流程图 + 实时状态 | 无 | 🟢 增强 | P2 |
| **多平台接入** | CLI + Web + 消息平台 + MCP | CLI + 只读 Web | 🟢 增强 | P2 |
| **HITL 检查点** | 关键决策点人类介入 | 仅安全审批 | 🟢 增强 | P2 |
| **定时自主任务** | cron + 自然语言定义 + 平台推送 | 仅 fetcher 管道 | 🟢 增强 | P3 |
| **Trajectory 压缩** | 执行轨迹压缩用于训练 | 无 | 🔵 远期 | P4 |

### 12.4 自我进化路线图（基于行业对标）

在原有 Phase 1-4 基础上，增加自我进化相关 Phase：

```
Phase 1 (后端 API)  →  Phase 2 (前端功能页)  →  Phase 3 (安全审批)  →  Phase 4 (高级特性)
                                                                      ↓
                                                              Phase 5 (自我进化)
                                                                      ↓
                                                              Phase 6 (生态扩展)
```

#### Phase 5：自我进化引擎

| 任务 | 说明 | 参考项目 | 涉及文件 |
|------|------|----------|----------|
| 5.1 Skill 自动提取 | AgentLoop 完成任务后，自动从执行轨迹中提取可复用 Skill 并持久化到 `skills/` 目录 | Hermes Agent | `tools/jarvis/learner.py` + `tools/skill_engine.py` |
| 5.2 Skill 使用中改进 | 执行 Skill 时记录成功率和耗时，自动优化低效步骤 | Hermes Agent | `tools/skill_engine.py` |
| 5.3 执行轨迹存储 | 将每次 AgentLoop 的完整执行轨迹（plan/tool_calls/reflection/result）持久化到 PostgreSQL | Hermes Agent (trajectory_compressor) | `tools/jarvis/loop.py` + DB schema |
| 5.4 策略进化引擎 | 评估器评分结果后，自动调整 planner 的策略权重和参数 | EvoAgentX (EvolutionEngine) | `tools/jarvis/planner.py` + `tools/jarvis/evaluator.py` |
| 5.5 跨会话经验召回 | 新目标输入时，自动搜索历史执行轨迹中的相似任务，提取经验作为上下文 | Hermes Agent (FTS5 search) | `tools/jarvis/learner.py` + `tools/shared/search_backend.py` |
| 5.6 工作流可视化 | 将执行轨迹渲染为 DAG 流程图，展示每步的状态和依赖 | EvoAgentX (workflow_graph.display) | 前端 `ExecutionDAG.tsx` |

#### Phase 6：生态扩展

| 任务 | 说明 | 参考项目 |
|------|------|----------|
| 6.1 消息平台集成 | 通过 Telegram/Discord/Slack 与 Jarvis 交互 | Hermes Agent (gateway) |
| 6.2 定时自主任务 | 用户用自然语言定义定时任务，Jarvis 自主执行并推送结果 | Hermes Agent (cron) |
| 6.3 用户建模 | 基于交互历史构建用户偏好模型，个性化任务执行策略 | Hermes Agent (Honcho) |
| 6.4 工作流自动构建 | 从自然语言目标自动生成多 Agent 协作工作流 | EvoAgentX (WorkFlowGenerator) |
| 6.5 Trajectory 训练数据 | 导出执行轨迹为训练数据格式，用于微调工具调用模型 | Hermes Agent (Atropos RL) |

---

*报告结束。*

**推荐阅读顺序**：
1. 如需立即打通前后端 → 从 **Phase 1**（后端 API 管道）开始
2. 如需构建 Jarvis 功能页 → 从 **Phase 2**（前端功能页）开始
3. 如需长期自我进化能力 → 参考 **Section 12**（行业对标）+ **Phase 5-6**（自我进化 + 生态扩展）
