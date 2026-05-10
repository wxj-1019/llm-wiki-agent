# Jarvis Evolution Plan — 从 LLM Wiki Agent 到自主智能助手

> **目标**: 将当前的被动知识管理系统进化为一个能自主感知、决策、行动、学习的全自主智能助手
> **自主级别**: 全自主（安全红线约束）
> **工具范围**: 系统操作 + 网络工具 + 开发工具 + 通讯工具
> **自我更新**: 知识+配置自动更新，代码修改需审批

---

## 一、架构总览：Jarvis 五层模型

```
┌─────────────────────────────────────────────────────────┐
│                    Layer 5: 交互层                        │
│   Chat UI · 语音 · 通知 · Dashboard · PWA               │
├─────────────────────────────────────────────────────────┤
│                    Layer 4: Agent Loop                    │
│   感知 → 推理 → 规划 → 执行 → 反馈 → 学习               │
├─────────────────────────────────────────────────────────┤
│                    Layer 3: 工具协议层                     │
│   Tool Registry · MCP Client · 权限沙箱 · 审计日志       │
├─────────────────────────────────────────────────────────┤
│                    Layer 2: 能力层                        │
│   知识管理 · 数据获取 · 代码操作 · 系统管理 · 通讯       │
├─────────────────────────────────────────────────────────┤
│                    Layer 1: 基础设施层                    │
│   LLM Gateway · 状态管理 · 调度器 · 事件总线 · 安全引擎  │
└─────────────────────────────────────────────────────────┘
```

---

## 二、核心组件设计

### 2.1 Agent Loop — Jarvis 的大脑 (`tools/jarvis/loop.py`)

这是最核心的改变：从被动工具调用 → 自主循环。

```
while True:
    events = perceive()           # 感知：收集系统状态、新事件、用户请求
    insights = reason(events)     # 推理：分析当前情况，识别需要行动的机会
    plan = plan(insights)         # 规划：制定行动方案（单步或多步 DAG）
    results = execute(plan)       # 执行：调用工具链，监控进度
    learn(results)                # 学习：更新记忆、调整策略、优化阈值
    wait(next_cycle)              # 等待：根据紧急程度动态调整轮询间隔
```

**关键设计决策：**
- 每个循环有唯一的 `cycle_id`，全程追踪
- 高风险操作自动进入审批队列
- 循环频率自适应：空闲时 5 分钟，有任务时即时
- 支持被用户请求中断（优先处理用户任务）

### 2.2 事件总线 (`tools/jarvis/event_bus.py`)

将所有"发生的事"统一为事件流，Agent Loop 通过订阅事件来感知。

**事件类型：**

| 类别 | 事件 | 触发 |
|---|---|---|
| 系统 | `health.degraded` | 健康检查发现问题 |
| 系统 | `quality.low` | 页面质量低于阈值 |
| 系统 | `budget.warning` | LLM 预算超 80% |
| 系统 | `circuit.open` | 熔断器打开 |
| 数据 | `file.added` | raw/ 目录新增文件 |
| 数据 | `source.changed` | 上游源内容变更 |
| 数据 | `crawler.done` | 爬取完成 |
| 用户 | `user.query` | 用户提问 |
| 用户 | `user.command` | 用户命令 |
| 用户 | `user.feedback` | 用户反馈 |
| 外部 | `webhook.received` | 收到外部 webhook |
| 外部 | `schedule.trigger` | 定时任务触发 |
| Agent | `plan.approved` | 审批通过 |
| Agent | `plan.rejected` | 审批被拒绝 |
| Agent | `action.completed` | 操作完成 |
| Agent | `action.failed` | 操作失败 |

### 2.3 工具协议层 (`tools/jarvis/tool_registry.py`)

统一所有工具的注册、发现、调用、权限管理。

**工具分类与权限等级：**

| 等级 | 权限 | 工具示例 |
|---|---|---|
| L0 (安全) | 无需审批 | wiki_read, search, health_check, quality_score |
| L1 (低风险) | 自动执行 | wiki_write, ingest, lint, heal, refresh, crawl |
| L2 (中风险) | 自动执行+记录 | config_update, threshold_update, skill_install, mcp_call |
| L3 (高风险) | 需要审批 | code_modify, system_exec, git_push, deploy, email_send |
| L4 (关键) | 需要审批+确认 | db_drop, system_shutdown, api_key_update |

**工具注册格式：**
```python
@register_tool(
    name="wiki_write",
    level="L1",
    description="创建或更新 wiki 页面",
    input_schema={...},
    output_schema={...},
)
async def wiki_write(path: str, content: str) -> ToolResult:
    ...
```

### 2.4 规划引擎 (`tools/jarvis/planner.py`)

将高层目标分解为可执行的工具调用 DAG。

**示例：用户说"帮我追踪 Transformer 领域最新进展"**

```
Goal: 追踪 Transformer 最新进展
  ├─ Step 1: web_search("transformer 2026 latest papers") [L0]
  ├─ Step 2: arxiv_fetch("transformer", max=10) [L1]
  ├─ Step 3: Parallel:
  │   ├─ Step 3a: ingest(paper_1) [L1]
  │   ├─ Step 3b: ingest(paper_2) [L1]
  │   └─ Step 3c: ingest(paper_3) [L1]
  ├─ Step 4: build_graph() [L1]
  ├─ Step 5: quality_check(new_pages) [L0]
  └─ Step 6: notify(user, "已摄入 {N} 篇 Transformer 论文") [L2]
```

### 2.5 安全引擎 (`tools/jarvis/safety.py`)

全自主模式下的安全护栏：

1. **操作预检**: 每个操作执行前评估风险
2. **速率限制**: 每分钟/小时/天的操作上限
3. **回滚机制**: 关键操作前自动创建快照
4. **红线规则**: 不可违反的硬约束
5. **审计日志**: 所有操作的完整记录

**红线规则：**
- 永不删除 `raw/` 目录中的源文件
- 永不暴露 API key 到日志或 wiki 内容
- 永不在未审批的情况下修改 `tools/` 下的 Python 代码
- 永不向外部发送用户私有数据
- 每日 LLM 支出不超过预算上限
- 每小时最多执行 100 次工具调用

---

## 三、新增能力模块

### 3.1 系统操作工具包 (`tools/jarvis/tools/system_tools.py`)

| 工具 | 功能 | 权限 |
|---|---|---|
| `file_read` | 读取任意文件 | L0 |
| `file_write` | 写入文件 | L2 |
| `file_list` | 列出目录 | L0 |
| `process_list` | 列出运行进程 | L0 |
| `process_kill` | 终止进程 | L3 |
| `terminal_exec` | 执行终端命令 | L3 |
| `system_info` | 系统信息(CPU/内存/磁盘) | L0 |

### 3.2 网络工具包 (`tools/jarvis/tools/web_tools.py`)

| 工具 | 功能 | 权限 |
|---|---|---|
| `web_search` | 搜索引擎(DuckDuckGo) | L0 |
| `web_fetch` | 抓取网页内容 | L1 |
| `api_call` | 调用外部 REST API | L2 |
| `webhook_send` | 发送 webhook | L2 |
| `download` | 下载文件 | L1 |

### 3.3 开发工具包 (`tools/jarvis/tools/dev_tools.py`)

| 工具 | 功能 | 权限 |
|---|---|---|
| `git_status` | 查看 Git 状态 | L0 |
| `git_diff` | 查看变更 | L0 |
| `git_commit` | 提交变更 | L3 |
| `git_push` | 推送远程 | L3 |
| `db_query` | 数据库查询 | L2 |
| `db_migrate` | 数据库迁移 | L3 |
| `build_run` | 构建项目 | L2 |
| `test_run` | 运行测试 | L1 |
| `deploy` | 部署服务 | L3 |

### 3.4 通讯工具包 (`tools/jarvis/tools/comm_tools.py`)

| 工具 | 功能 | 权限 |
|---|---|---|
| `notify_desktop` | 桌面通知 | L0 |
| `notify_email` | 发送邮件 | L3 |
| `notify_webhook` | 发送 Webhook 通知 | L2 |
| `schedule_reminder` | 设置提醒 | L1 |
| `calendar_check` | 查看日程 | L0 |

### 3.5 知识工具包 (已有，整合进 Registry)

将现有的 `ingest`, `query`, `lint`, `health`, `heal`, `refresh`, `build_graph`, `reflect` 等全部注册为标准工具。

---

## 四、Agent Loop 详细设计

### 4.1 感知阶段 (`perceive()`)

```python
async def perceive() -> list[Event]:
    events = []

    # 1. 检查事件总线中的新事件
    events.extend(event_bus.poll())

    # 2. 检查用户请求队列
    events.extend(user_queue.poll())

    # 3. 健康快照（每 5 分钟）
    if time_since_last_health > 300:
        health = run_health()
        if health.has_issues():
            events.append(Event("health.degraded", health))
        events.append(Event("system.heartbeat", health))

    # 4. 质量快照（每小时）
    if time_since_last_quality > 3600:
        quality = score_all_pages()
        low_pages = [p for p in quality if p.score < 40]
        if low_pages:
            events.append(Event("quality.low", low_pages))
        events.append(Event("system.quality", quality))

    # 5. 预算检查
    budget = get_budget_status()
    if budget.percent > 80:
        events.append(Event("budget.warning", budget))

    return events
```

### 4.2 推理阶段 (`reason()`)

使用 LLM 分析事件流，决定是否需要行动。

```python
async def reason(events: list[Event]) -> list[Insight]:
    prompt = f"""
    你是 Jarvis，一个自主知识管理助手。以下是当前事件：

    {format_events(events)}

    系统状态：
    - LLM 预算使用：{budget.percent}%
    - Wiki 页面数：{page_count}
    - 上次优化：{last_optimize}
    - 待处理任务：{pending_tasks}

    请分析这些事件，识别需要你采取行动的机会。
    对于每个机会，评估：
    1. 紧急程度 (critical/high/medium/low)
    2. 建议行动
    3. 预计工具调用
    4. 风险等级
    """
    return await call_llm(prompt)
```

### 4.3 规划阶段 (`plan()`)

将推理结果转化为可执行的计划 DAG。

```python
async def plan(insights: list[Insight]) -> Plan:
    # 按优先级排序
    insights.sort(key=lambda i: priority_order(i.urgency))

    plan = Plan()
    for insight in insights:
        # 生成工具调用步骤
        steps = await generate_steps(insight)
        for step in steps:
            if step.tool.level >= L3:
                step.requires_approval = True
            plan.add_step(step)

    # 优化：合并相同工具调用、并行化独立步骤
    plan.optimize()
    return plan
```

### 4.4 执行阶段 (`execute()`)

```python
async def execute(plan: Plan) -> list[ActionResult]:
    results = []
    for step in plan.steps:
        if step.requires_approval:
            approval = await request_approval(step)
            if not approval.granted:
                results.append(ActionResult(skipped=True, reason="审批被拒绝"))
                continue

        # 安全预检
        safety_check = safety_engine.pre_check(step)
        if not safety_check.passed:
            results.append(ActionResult(failed=True, reason=safety_check.reason))
            continue

        # 执行
        result = await tool_registry.execute(step.tool, step.params)
        results.append(result)

        # 审计日志
        audit_log.record(step, result)

        # 如果失败且可重试
        if result.failed and result.retryable:
            result = await retry_with_backoff(step)

    return results
```

### 4.5 学习阶段 (`learn()`)

```python
async def learn(results: list[ActionResult]):
    # 1. 更新 Agent 记忆
    memory.update(results)

    # 2. 调整阈值（基于执行模式）
    auto_adjust_thresholds(results)

    # 3. 更新工具成功率统计
    tool_registry.update_stats(results)

    # 4. 如果发现新的可提取技能模式
    new_skills = analyze_for_skills(results)
    for skill in new_skills:
        suggest_skill_creation(skill)

    # 5. 更新 Agent 自身状态
    agent_state.record_cycle(results)
```

---

## 五、审批系统

全自主模式下仍需要审批的 L3+ 操作通过以下方式处理：

### 5.1 Dashboard 审批队列

前端新增 `/approvals` 页面，显示待审批的操作列表：

```
┌─────────────────────────────────────────────┐
│  🔔 审批队列 (3)                             │
├─────────────────────────────────────────────┤
│  □ git_commit("auto-fix: 修复断链 x4")      │
│    工具: git_commit | 风险: L3 | 2分钟前     │
│    [✅ 批准] [❌ 拒绝] [👁 预览]              │
├─────────────────────────────────────────────┤
│  □ terminal_exec("pip install markitdown")   │
│    工具: terminal_exec | 风险: L3 | 5分钟前  │
│    [✅ 批准] [❌ 拒绝] [👁 预览]              │
├─────────────────────────────────────────────┤
│  □ email_send("weekly-report@...")           │
│    工具: email_send | 风险: L3 | 10分钟前    │
│    [✅ 批准] [❌ 拒绝] [👁 预览]              │
└─────────────────────────────────────────────┘
```

### 5.2 审批 API

```python
# 提交审批请求
POST /api/approvals
{
    "action": "git_commit",
    "params": {"message": "auto-fix: 修复断链 x4"},
    "risk_level": "L3",
    "reason": "lint 发现 4 个断链，已自动修复，需要提交"
}

# 批准/拒绝
POST /api/approvals/{id}/approve
POST /api/approvals/{id}/reject

# 查询待审批
GET /api/approvals?status=pending
```

### 5.3 自动审批策略

可配置自动审批规则（降低审批疲劳）：

```yaml
# config/approval_policies.yaml
auto_approve:
  - pattern: "git_commit(message=auto-fix:*)"
    max_per_hour: 5
  - pattern: "terminal_exec(command=npm run build)"
    max_per_hour: 3
  - pattern: "email_send(to=me@*)"
    max_per_day: 10
never_auto_approve:
  - "git_push"
  - "terminal_exec(command=rm *)"
  - "deploy"
```

---

## 六、前端进化

### 6.1 新增页面

| 页面 | 路径 | 功能 |
|---|---|---|
| Jarvis Dashboard | `/jarvis` | Agent 状态总览、当前任务、事件流 |
| 审批队列 | `/approvals` | L3+ 操作审批管理 |
| 工具管理 | `/tools` | 工具注册表、权限配置、使用统计 |
| 任务历史 | `/tasks` | 执行历史、成功率、耗时趋势 |
| Agent 日志 | `/agent-log` | Agent Loop 详细日志、决策追踪 |

### 6.2 Jarvis Dashboard 设计

```
┌──────────────────────────────────────────────────────────┐
│  🤖 Jarvis                                    [⏸ 暂停]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  状态: 🟢 运行中  |  循环 #1,247  |  上次: 30秒前         │
│                                                          │
│  ┌────────────────┐  ┌────────────────┐                  │
│  │  今日统计       │  │  当前任务       │                  │
│  │  工具调用: 89   │  │  ⏳ 正在摄入... │                  │
│  │  成功率: 96%    │  │  ✅ 已完成 x3   │                  │
│  │  预算: $2.3/5   │  │  ⏸ 等待审批 x1 │                  │
│  │  学习: +3 模式  │  │                │                  │
│  └────────────────┘  └────────────────┘                  │
│                                                          │
│  ┌─────────────────────────────────────────────┐         │
│  │  📋 事件流 (最近)                            │         │
│  │  10:23  health.degraded  →  3个断链已修复     │         │
│  │  10:20  source.changed   →  触发重新摄入      │         │
│  │  10:15  user.query       →  回答并保存合成    │         │
│  │  10:00  schedule.trigger →  RSS 抓取完成      │         │
│  └─────────────────────────────────────────────┘         │
│                                                          │
│  ┌─────────────────────────────────────────────┐         │
│  │  🧠 Agent 记忆                               │         │
│  │  已学习: 47 条经验 | 12 条策略 | 3 条模板     │         │
│  │  最近学习: "arXiv 论文抓取后应立即检查质量"    │         │
│  └─────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────┘
```

---

## 七、实现路线图

### Phase 1: 基础骨架 (P0 — Agent Loop 核心)

**目标**: 让 Jarvis 能跑起来，完成 感知→决策→行动 的最小循环

| # | 任务 | 文件 | 描述 |
|---|---|---|---|
| 1.1 | 事件总线 | `tools/jarvis/event_bus.py` | 事件定义、发布/订阅、SQLite 持久化 |
| 1.2 | 工具注册表 | `tools/jarvis/tool_registry.py` | 装饰器注册、权限分级、调用路由 |
| 1.3 | 安全引擎 | `tools/jarvis/safety.py` | 红线规则、速率限制、预检机制 |
| 1.4 | Agent Loop | `tools/jarvis/loop.py` | 感知→推理→规划→执行→学习 循环 |
| 1.5 | 审批系统 | `tools/jarvis/approval.py` | 审批队列、API、自动审批策略 |
| 1.6 | Jarvis CLI | `tools/jarvis_cli.py` | `jarvis start/stop/status/pause/resume` |
| 1.7 | 注册已有工具 | `tools/jarvis/tools/knowledge_tools.py` | 将现有 ingest/query/lint/health 等注册 |

### Phase 2: 工具扩展 (P1 — 四大工具包)

**目标**: 让 Jarvis 能操作外部世界

| # | 任务 | 文件 | 描述 |
|---|---|---|---|
| 2.1 | 系统工具包 | `tools/jarvis/tools/system_tools.py` | 文件读写、进程管理、终端执行 |
| 2.2 | 网络工具包 | `tools/jarvis/tools/web_tools.py` | 搜索、抓取、API 调用、下载 |
| 2.3 | 开发工具包 | `tools/jarvis/tools/dev_tools.py` | Git 操作、数据库、构建、测试、部署 |
| 2.4 | 通讯工具包 | `tools/jarvis/tools/comm_tools.py` | 桌面通知、邮件、Webhook、日程 |
| 2.5 | MCP 客户端 | `tools/jarvis/tools/mcp_client.py` | MCP JSON-RPC 客户端，动态工具发现 |
| 2.6 | 工具组合 | `tools/jarvis/tools/composite_tools.py` | 常用工具链预设（如 "完整摄入管道"） |

### Phase 3: 智能进化 (P2 — 规划与学习)

**目标**: 让 Jarvis 真正"聪明"

| # | 任务 | 文件 | 描述 |
|---|---|---|---|
| 3.1 | 规划引擎 | `tools/jarvis/planner.py` | DAG 生成、条件分支、并行执行 |
| 3.2 | 学习引擎 | `tools/jarvis/learner.py` | 执行模式提取、阈值自动调整、技能建议 |
| 3.3 | 策略管理 | `tools/jarvis/strategies.py` | 可选策略库（保守/积极/自定义） |
| 3.4 | 目标系统 | `tools/jarvis/goals.py` | 用户定义目标、进度追踪、达成评估 |

### Phase 4: 前端进化 (P2 — Jarvis UI)

**目标**: 让用户能可视化管理和监控 Jarvis

| # | 任务 | 文件 | 描述 |
|---|---|---|---|
| 4.1 | Jarvis Dashboard | `wiki-viewer/src/pages/JarvisPage.tsx` | Agent 状态、事件流、实时任务 |
| 4.2 | 审批页面 | `wiki-viewer/src/pages/ApprovalsPage.tsx` | 审批队列管理 |
| 4.3 | 工具页面 | `wiki-viewer/src/pages/ToolsPage.tsx` | 工具注册表浏览 |
| 4.4 | 任务历史 | `wiki-viewer/src/pages/TasksPage.tsx` | 执行历史、成功率图表 |
| 4.5 | Agent 日志 | `wiki-viewer/src/pages/AgentLogPage.tsx` | 实时日志流 |
| 4.6 | API 端点 | `tools/api_server.py` 扩展 | 审批/Agent 状态/工具管理 API |

### Phase 5: 高级能力 (P3 — 多模态与多Agent)

**目标**: 让 Jarvis 成为真正的全能助手

| # | 任务 | 文件 | 描述 |
|---|---|---|---|
| 5.1 | 语音交互 | `tools/jarvis/voice.py` | 语音识别 + 语音合成 |
| 5.2 | 多 Agent | `tools/jarvis/multi_agent.py` | Agent 间通信、任务分配 |
| 5.3 | 插件市场 | `tools/jarvis/plugin_market.py` | 第三方工具/能力安装 |
| 5.4 | 自我诊断 | `tools/jarvis/self_diagnose.py` | Agent 自身性能分析、瓶颈检测 |

---

## 八、目录结构

```
tools/jarvis/
├── __init__.py
├── loop.py                 # Agent Loop 主循环
├── event_bus.py            # 事件总线
├── tool_registry.py        # 工具注册表
├── safety.py               # 安全引擎
├── approval.py             # 审批系统
├── planner.py              # 规划引擎
├── learner.py              # 学习引擎
├── strategies.py           # 策略管理
├── goals.py                # 目标系统
├── types.py                # 类型定义
├── config.py               # Jarvis 配置
├── state.py                # Agent 状态管理
└── tools/
    ├── __init__.py
    ├── knowledge_tools.py  # 知识管理工具（包装已有工具）
    ├── system_tools.py     # 系统操作工具
    ├── web_tools.py        # 网络工具
    ├── dev_tools.py        # 开发工具
    ├── comm_tools.py       # 通讯工具
    ├── mcp_client.py       # MCP 客户端
    └── composite_tools.py  # 组合工具
```

---

## 九、配置文件

### `config/jarvis.yaml`

```yaml
agent:
  name: "Jarvis"
  cycle_interval: 300        # 空闲时循环间隔（秒）
  cycle_interval_busy: 10    # 有任务时循环间隔（秒）
  max_concurrent_tasks: 5
  learning_enabled: true
  auto_approve_enabled: true

safety:
  red_lines:
    - "never_delete_raw_files"
    - "never_expose_api_keys"
    - "never_modify_tools_without_approval"
    - "never_send_private_data_externally"
  rate_limits:
    max_tool_calls_per_minute: 30
    max_tool_calls_per_hour: 200
    max_tool_calls_per_day: 1000
  budget:
    daily_usd: 5.0
    warning_percent: 80

tools:
  system:
    enabled: true
    allowed_commands: ["ls", "cat", "grep", "git", "python", "npm", "pip"]
    blocked_commands: ["rm -rf /", "format", "del /s"]
  web:
    enabled: true
    max_concurrent_fetches: 5
    user_agent: "Jarvis/1.0"
  dev:
    enabled: true
    git_auto_commit: false    # 需审批
    auto_test_after_change: true
  comm:
    enabled: true
    desktop_notifications: true
    email:
      enabled: false          # 需配置 SMTP
      smtp_host: ""
      smtp_port: 587
```

### `config/approval_policies.yaml`

```yaml
auto_approve:
  - pattern: "git_commit(message=auto-fix:*)"
    max_per_hour: 5
  - pattern: "terminal_exec(command=npm run *)"
    max_per_hour: 3
  - pattern: "terminal_exec(command=python tools/health.py*)"
    max_per_hour: 10

never_auto_approve:
  - "git_push"
  - "terminal_exec(command=rm *)"
  - "terminal_exec(command=del *)"
  - "deploy"
  - "email_send"
```

---

## 十、与现有系统的集成点

| 现有组件 | 集成方式 |
|---|---|
| `self_optimize.py` | 成为 Agent Loop 的一个"策略"，定期触发 |
| `scheduler.py` | 事件源：定时任务触发 → 事件总线 → Agent Loop |
| `watcher.py` | 事件源：文件变更 → 事件总线 → Agent Loop |
| `reflect.py` | 学习阶段的核心组件 |
| `health.py` / `lint.py` | 感知阶段的传感器 |
| `heal.py` / `refresh.py` | 执行阶段的工具 |
| `skill_engine.py` | 作为工具注册进 Tool Registry |
| `mcp_server.py` | Jarvis 对外暴露的 MCP 接口 |
| `mcp_manager.py` | MCP 客户端管理的包装 |
| `quality.py` | 感知阶段的质量传感器 |
| `thresholds.py` | 学习阶段的阈值调整目标 |
| `llm.py` (call_llm) | 所有 LLM 调用的基础设施 |
| `api_server.py` | 新增 Jarvis 相关 API 端点 |
| `wikiStore.ts` | 新增 Jarvis 状态管理 |

---

## 十一、安全与治理

### 11.1 审计日志

所有 Agent 操作记录到 `state/audit_log.jsonl`：

```json
{
  "timestamp": "2026-05-10T10:23:45",
  "cycle_id": "cycle_1247",
  "tool": "wiki_write",
  "params": {"path": "wiki/entities/NewEntity.md", "content": "..."},
  "risk_level": "L1",
  "approved_by": "auto",
  "result": "success",
  "duration_ms": 150,
  "tokens_used": {"input": 500, "output": 200}
}
```

### 11.2 回滚机制

- 每次修改 wiki 页面前，自动保存旧版本到 `state/snapshots/`
- Git 作为最终回滚手段：Agent 可自动 commit 但不可自动 push
- 配置修改前自动备份旧配置

### 11.3 紧急停止

- `jarvis stop` 命令立即停止 Agent Loop
- 前端 Dashboard 上的紧急停止按钮
- 连续 3 次循环失败自动停止
- 预算超限自动停止
