# LLM Wiki Agent — 跨领域整合发散思维报告

> 版本：v1.0 | 日期：2026-05-03 | 搜索范围：8 大维度 × 40+ 项目

---

## 目录

1. [总览：8 大整合维度](#1-总览8-大整合维度)
2. [维度一：信息采集层](#2-维度一信息采集层--web-clipper--书签管理)
3. [维度二：自动化工作流](#3-维度二自动化工作流--n8ndifyactivepieces)
4. [维度三：协同编辑](#4-维度三协同编辑--crdt--实时协作)
5. [维度四：移动端/多端访问](#5-维度四移动端多端访问)
6. [维度五：可视化增强](#6-维度五可视化增强)
7. [维度六：学术/研究增强](#7-维度六学术研究增强)
8. [维度七：AI Agent 深度集成](#8-维度七ai-agent-深度集成)
9. [维度八：基础设施/部署增强](#9-维度八基础设施部署增强)
10. [整合优先级矩阵](#10-整合优先级矩阵)
11. [最具颠覆性的 3 个整合方向](#11-最具颠覆性的-3-个整合方向)
12. [参考资源索引](#12-参考资源索引)

---

## 1. 总览：8 大整合维度

```
                        ┌─────────────────────────┐
                        │     LLM Wiki Agent      │
                        │    （知识编译核心引擎）    │
                        └────────────┬────────────┘
                                     │
          ┌─────────────┬────────────┼────────────┬─────────────┐
          ▼             ▼            ▼            ▼             ▼
    ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │  信息采集  │ │ 自动化   │ │ 协同编辑  │ │ 多端访问  │ │ 可视化   │
    │  Web Clip │ │ n8n/GitHub│ │ Y.js/CRDT│ │ PWA/Bot  │ │ D3/Sigma │
    └───────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
          ┌─────────────┬────────────┼────────────┬─────────────┐
          ▼             ▼            ▼            ▼             ▼
    ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │  学术研究  │ │ AI Agent │ │ 部署增强  │ │           │ │          │
    │  Zotero   │ │ CrewAI   │ │ Tauri    │ │           │ │          │
    └───────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

每个维度的核心理念：**让 Wiki 从"静态知识库"进化为"活的知识中枢"**。

---

## 2. 维度一：信息采集层 — Web Clipper + 书签管理

### 2.1 问题分析

用户的知识来源是多样化的：
- 📄 文件（PDF、Word、PPT）← 已支持
- 🌐 网页/文章 ← **未支持**（最大痛点）
- 📧 邮件/通讯 ← 未支持
- 📱 社交媒体 ← 未支持
- 🎥 视频/播客 ← 未支持

**"收藏即遗忘"是知识管理的最大杀手**。Karakeep 20K+ star 证明了解决方案的市场需求。

### 2.2 可整合项目

| 项目 | Stars | 核心能力 | 整合方式 |
|---|---|---|---|
| **[Karakeep](https://github.com/karakeep/hoarder)** | 20K+ | 自托管书签管理器，AI 自动标签 + 全文搜索 + Chrome/Firefox 扩展 + iOS/Android App | 作为 `raw/` 的上游：收藏 URL → 自动抓取 → 存入 `raw/` → 触发 ingest |
| **[stash-bookmark](https://github.com/ayoub9360/stash-bookmark)** | 新 | 粘贴 URL → AI 摘要 + 分类 + 标签 + 自然语言搜索，Docker 一键部署 | 复用其 AI 摘要和自动分类逻辑，作为 ingest 前的预处理层 |
| **[bookmark-is-learned](https://github.com/Luis02051/bookmark-is-learned)** | 新 | Chrome 扩展：收藏时即时 AI TLDR 摘要，强制"学习或丢弃"决策 | 浏览器扩展 → 保存到 `raw/` → 触发 ingest → 从"收藏"到"学习"的闭环 |
| **[LocalForge Bookmarks](https://github.com/longregen/bookmarks)** | 活跃 | 浏览器扩展 + 自托管 Deno/CF Workers 同步 + RAG 语义搜索 | 扩展作为采集入口，Wiki 作为知识沉淀层 |
| **[Jina Reader](https://jina.ai/reader/)** | API | `r.jina.ai/<url>` 一行命令将任意网页转为干净 Markdown | 最简单的整合：URL → Jina Reader → `raw/` 文件 → ingest |

### 2.3 整合方案

```
浏览器扩展（Chrome/Firefox）
├── 右键菜单："保存到 Wiki"
├── Popup 面板：输入标签/备注 → AI 自动摘要
├── 快捷键：Ctrl+Shift+S 一键保存
└── 后台：Jina Reader / Readability.js 提取正文
     │
     ▼
API Server（/api/webhook/clip）
├── 接收 URL + 元数据
├── Jina Reader 转为 Markdown
├── 存入 raw/clipped/<slug>.md
├── 触发 ingest 流程
└── 返回 Wiki 页面链接
```

### 2.4 差异化价值

- **Karakeep 只做书签管理，不做知识编译**。我们的优势是 ingest → entity/concept 页面 → 知识图谱
- **bookmark-is-learned 只做即时学习，不做长期积累**。Wiki 天然是长期积累层
- 组合起来：**采集 → 编译 → 积累 → 查询** 的完整闭环

---

## 3. 维度二：自动化工作流 — n8n/Dify/Activepieces

### 3.1 问题分析

当前 Wiki 是"手动驱动"的：用户手动放入文件 → 手动运行 ingest → 手动查询。应该变成"事件驱动"：各种触发器自动驱动知识流入和更新。

### 3.2 可整合项目

| 项目 | Stars | 核心能力 | 整合方式 |
|---|---|---|---|
| **[n8n](https://n8n.io)** | 60K+ | 可视化自动化平台，400+ 集成，自托管 | 自定义 n8n 节点 `@llm-wiki-agent/n8n-node`，暴露 ingest/query/health 操作 |
| **[Dify](https://github.com/langgenius/dify)** | 90K+ | LLM 应用开发平台，可视化 Agent 编排 | 将 Wiki 搜索和查询暴露为 Dify Tool，让任何 Dify 工作流都能查询知识库 |
| **[Activepieces](https://github.com/activepieces/activepieces)** | 15K+ | 开源 Zapier 替代品 | 创建 Wiki Agent Piece：Trigger（新邮件/RSS/GitHub Issue）→ Action（ingest 到 Wiki） |
| **GitHub Actions** | 内置 | CI/CD 自动化 | `on: push` → 自动检查 `raw/` 变更 → 调用 ingest API → 更新 Wiki → commit 回去 |
| **[Huginn](https://github.com/huginn/huginn)** | 44K+ | 自托管 IFTTT | Agent 监控 RSS/Twitter/网页 → 新内容自动推送至 `raw/` → ingest |

### 3.3 整合方案

#### 方案 A：Webhook API

在 `api_server.py` 中新增 Webhook 端点：

```python
# api_server.py 新增
@app.post("/api/webhook/n8n")
async def webhook_n8n(payload: WebhookPayload):
    """n8n/GitHub Actions 通用 Webhook"""
    if payload.action == "ingest":
        result = await ingest_file(payload.file_path)
    elif payload.action == "query":
        result = await query_wiki(payload.question)
    elif payload.action == "health":
        result = await health_check()
    return result

@app.post("/api/webhook/github")
async def webhook_github(request: Request):
    """GitHub Webhook：push 时自动 ingest 变更文件"""
    payload = await request.json()
    if payload.get("ref") == "refs/heads/main":
        for commit in payload.get("commits", []):
            for f in commit.get("added", []) + commit.get("modified", []):
                if f.startswith("raw/"):
                    await ingest_file(f)
```

#### 方案 B：n8n 自定义节点

```json
{
  "name": "LLM Wiki Agent",
  "node": "LlmWikiAgent",
  "credentials": [{ "name": "llmWikiApi", "required": true }],
  "operations": [
    { "action": "ingest", "description": "Ingest a file into the wiki" },
    { "action": "query", "description": "Query the wiki with a question" },
    { "action": "health", "description": "Run health check" },
    { "action": "search", "description": "Search wiki pages" }
  ]
}
```

#### 方案 C：GitHub Action

```yaml
# .github/workflows/auto-ingest.yml
name: Auto Ingest
on:
  push:
    paths: ['raw/**']
jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Get changed files
        id: changed
        uses: tj-actions/changed-files@v44
        with:
          files: raw/**
      - name: Ingest to Wiki
        env:
          API_URL: http://localhost:8000
        run: |
          for file in ${{ steps.changed.outputs.all_changed_files }}; do
            curl -X POST "$API_URL/api/webhook/n8n" \
              -H "Content-Type: application/json" \
              -d "{\"action\": \"ingest\", \"file_path\": \"$file\"}"
          done
```

### 3.4 实际案例参考

- n8n 已有 **GitHub → 向量数据库同步** 的现成模板（监听 Release 事件自动同步）
- 有开发者用 n8n 做了 **GitHub 项目问答机器人**：GitHub Release → 分块 → 嵌入 → 向量数据库 → AI Agent 回答
- 有开发者用 n8n + MongoDB Atlas + Vertex AI 做了 **代码库自动索引**：Push → 增量更新向量数据库

---

## 4. 维度三：协同编辑 — CRDT + 实时协作

### 4.1 问题分析

当前 Wiki 的写入模式是：
- Agent 写（通过 ingest/query/lint）
- 人读（通过 Wiki Viewer）

如果**人和 Agent 可以同时编辑同一个页面**，会诞生一种全新的知识管理范式。

### 4.2 可整合项目

| 项目 | Stars | 核心能力 | 整合方式 |
|---|---|---|---|
| **[Y.js](https://github.com/yjs/yjs)** | 17K+ | CRDT 协同编辑框架，支持多人实时编辑，无冲突 | 集成到 React 前端，人和 Agent 共享编辑状态 |
| **[Tiptap](https://github.com/ueberdosis/tiptap)** | 30K+ | 无头富文本编辑器，原生支持 Y.js 绑定 | 替换/增强 MarkdownRenderer，支持所见即所得编辑 |
| **[HedgeDoc](https://github.com/hedgedoc/hedgedoc)** | 18K+ | 实时协同 Markdown 编辑器，自托管，Mermaid/MathJax | Wiki 页面在 HedgeDoc 中打开编辑，保存后写回 `wiki/` |
| **[CollabMD](https://news.ycombinator.com/item?id=47421425)** | HN 热门 | 基于 Y.js 的多人 Markdown 编辑器，支持 Git 集成和 Cloudflare Tunnel | 架构参考：本地 Node Server + Y.js CRDT + Git commit |
| **[Etherpad](https://github.com/ether/etherpad)** | 18K+ | 最成熟的开源实时协同编辑器，20 年历史 | 可作为重型协同编辑的后端引擎 |

### 4.3 整合方案

```
Phase 1：只读 + 轻量编辑（1 周）
├── PageDetailPage 添加"编辑"按钮
├── 打开 Tiptap 编辑器（Markdown 模式）
├── 保存时调用 API 写回 wiki/ 文件
└── 触发 graph rebuild（如果链接变更）

Phase 2：实时协同（3 周）
├── 集成 Y.js + WebSocket Server
├── 编辑器共享 Y.Doc 状态
├── 多人同时编辑，光标可见
└── 自动保存到 wiki/ 文件

Phase 3：人机协同（2 周）
├── Agent 通过 MCP write 工具修改 Y.Doc
├── 用户实时看到 Agent 的修改（像 Google Docs 协作）
├── Agent 的修改标记为不同颜色
└── 用户可以接受/拒绝 Agent 的修改
```

### 4.4 独特价值

**人与 AI 实时协同编辑知识页面**——这是所有竞品都没有的功能！

- llmwiki：Agent 写，人读
- SwarmVault：CLI 操作，人读
- wikillm：Claude Code 写，Obsidian 读
- **我们：人和 AI 同时编辑同一个页面** 🚀

---

## 5. 维度四：移动端/多端访问

### 5.1 问题分析

知识库只在电脑上可访问。但知识需求是随时随地的——开会时查概念、通勤时读笔记、灵感闪现时快速记录。

### 5.2 可整合项目

| 项目 | 整合方式 | 工作量 |
|---|---|---|
| **[Capacitor](https://capacitorjs.com/)** | React SPA → iOS/Android 原生 App，复用 100% 前端代码 | 1 周 |
| **PWA（Service Worker）** | 添加 `vite-plugin-pwa` → 离线浏览 Wiki + 桌面安装 | 3 天 |
| **[Telegram Bot API](https://core.telegram.org/bots/api)** | `/search <query>`、`/ingest <url>`、`/query <question>`、`/random`（随机知识） | 1 周 |
| **[Slack Bolt](https://slack.dev/bolt-python)** | Slash 命令：`/wiki search`、`/wiki ask` | 1 周 |
| **[Discord.py](https://discord.py/)** | Bot 命令：`!search`、`!ask` | 3 天 |
| **微信小程序** | 独立前端，调用 API Server（中国市场的独特差异化） | 4 周 |
| **[Mattermost](https://mattermost.com/)** | 企业聊天机器人集成 Plugin | 1 周 |

### 5.3 整合方案

```
优先级排序：

P0：Telegram Bot（1 周）
├── /start - Wiki 概览（页面数、最近更新）
├── /search <query> - 搜索 Wiki 页面
├── /ask <question> - AI 回答（调用 query API）
├── /ingest <url> - 保存网页到 Wiki
├── /random - 随机推荐一个知识页面
└── /graph - 发送知识图谱截图

P1：PWA 离线（3 天）
├── vite-plugin-pwa 配置
├── 缓存策略：Wiki 页面离线可读
├── 图谱和搜索需要网络
└── 支持桌面安装（独立窗口）

P2：Capacitor 移动 App（1 周）
├── 复用 100% React 前端代码
├── 原生分享菜单集成（分享到 Wiki）
├── 本地通知（每日知识摘要推送）
└── Touch ID / Face ID 解锁

P3：微信小程序（4 周）
├── 独立前端（微信小程序框架）
├── 调用 API Server
├── 中文市场差异化
└── 微信登录 + 分享到好友
```

### 5.4 参考案例

hermes-agent（116K star）已证明多平台接入是刚需：同时支持 Telegram、Discord、飞书、钉钉。

---

## 6. 维度五：可视化增强

### 6.1 问题分析

当前只有 vis.js 网络图。知识可视化可以更丰富：思维导图、时间线、桑基图、树状图。

### 6.2 可整合项目

| 项目 | Stars | 核心能力 | 整合方式 |
|---|---|---|---|
| **[Markmap](https://markmap.js.org/)** | 8K+ | Markdown → 交互式思维导图 | Wiki 页面一键生成思维导图视图，展示 `[[wikilinks]]` 的层级关系 |
| **[D3.js](https://d3js.org/)** | 110K+ | 数据驱动的可视化 | 时间线（log.md 演变）、桑基图（知识流动）、力导向图（图谱替代） |
| **[Sigma.js](https://github.com/jacomyal/sigma.js)** | 12K+ | 大规模图谱渲染（10K+ 节点） | 当节点超过 500 时自动从 vis.js 切换到 Sigma.js |
| **[React Flow](https://github.com/xyflow/xyflow)** | 30K+ | 可交互的节点编辑器 | 用户拖拽创建关系、编辑节点属性的可视化工作流 |
| **[Cytoscape.js](https://github.com/cytoscape/cytoscape.js)** | 10K+ | 图分析可视化，支持复杂布局 | 社区检测可视化、最短路径高亮、k-core 分解 |
| **[vis-timeline](https://github.com/visjs/vis-timeline)** | 4K+ | 交互式时间线组件 | 将 log.md 操作日志渲染为可视化时间线 |
| **[Mermaid.js](https://mermaid.js.org/)** | 80K+ | 流程图/时序图/甘特图 | Wiki 页面中的 Mermaid 代码块渲染（MarkdownRenderer 已部分支持） |

### 6.3 整合方案

```
新增可视化页面：

1. 思维导图视图（/mindmap/:slug）
   ├── 选中任意 Wiki 页面
   ├── 展开 [[wikilinks]] 为子节点
   ├── 递归展开 3 层
   └── 点击节点跳转到对应页面

2. 知识时间线（/timeline）
   ├── 基于 log.md 的操作日志
   ├── 横轴：时间，纵轴：操作类型
   ├── 点击事件节点查看详细变更
   └── 支持按日期范围/实体/概念过滤

3. 桑基图（/flow）
   ├── 展示知识流动方向
   ├── Source → Concept → Entity 的引用关系
   ├── 边宽 = 引用数量
   └── 发现知识的"热点"和"冷区"

4. 增强图谱（/graph）
   ├── < 500 节点：vis.js（当前）
   ├── > 500 节点：Sigma.js（性能优化）
   ├── 新增：最短路径高亮（A → B 怎么走）
   └── 新增：社区检测着色 + 聚类标签
```

---

## 7. 维度六：学术/研究增强

### 7.1 问题分析

研究人员是 LLM Wiki 的天然用户群体。他们需要引用管理、论文追踪、arXiv 集成、学术图谱。

### 7.2 可整合项目

| 项目 | 整合方式 |
|---|---|
| **[Zotero API](https://www.zotero.org/support/dev/web_api/v3/start)** | 导入文献库 → 自动 ingest 论文元数据 → 生成引用网络图谱 |
| **[arXiv API](https://arxiv.org/help/api/)** | 搜索/监控特定领域的最新论文 → 自动 ingest → 跟踪研究前沿 |
| **[Semantic Scholar API](https://api.semanticscholar.org/)** | 论文引用图谱 → 生成 Research Graph（谁引用了谁、知识传播路径） |
| **[Jina Reader](https://jina.ai/reader/)** | `r.jina.ai/<url>` 一行命令将任意网页/论文页面转为 Markdown |
| **[pyalex](https://github.com/J535D165/pyalex)** | Python OpenAlex 客户端（全球最大的开放学术元数据库） |
| **[Grobid](https://github.com/kermitt2/grobid)** | 学术 PDF 结构化提取（标题/作者/摘要/引用/章节） |

### 7.3 整合方案

```
新增研究工具：

1. tools/arxiv_monitor.py
   ├── 配置关注领域/关键词
   ├── 每日检查 arXiv 新论文
   ├── 自动下载 PDF → markitdown 转换 → ingest
   ├── 生成 wiki/concepts/ 研究前沿页面
   └── 邮件/Telegram 推送每日论文摘要

2. Wiki 页面类型：research
   ---
   title: "Paper Title"
   type: research
   tags: [paper, ml, attention-mechanism]
   authors: [Author1, Author2]
   venue: "NeurIPS 2025"
   arxiv_id: "2501.12345"
   citations: 42
   ---
   ## One-Sentence Summary
   ...
   ## Key Contributions
   ...
   ## Methodology
   ...
   ## Results
   ...
   ## Connections to Our Work
   ...

3. 引用图谱可视化
   ├── 基于 Semantic Scholar API
   ├── 节点 = 论文，边 = 引用关系
   ├── 高引用论文 = 大节点
   └── 支持时间轴播放（看知识如何传播）

4. Zotero 同步
   ├── OAuth 连接 Zotero 账户
   ├── 定期同步新增文献
   ├── 自动 ingest 论文元数据 + PDF
   └── Wiki 页面反向链接到 Zotero 条目
```

---

## 8. 维度七：AI Agent 深度集成

### 8.1 问题分析

Wiki 不应该只是 Agent 的输出目标，更应该是 Agent 的**持久记忆层**和**协作平台**。

### 8.2 可整合项目

| 项目 | Stars | 核心能力 | 整合方式 |
|---|---|---|---|
| **[hermes-agent](https://github.com/NousResearch/hermes-agent)** | 116K | 自进化 AI Agent：持久记忆 + 多平台 + 子代理 | hermes-agent 通过 MCP 连接 Wiki 作为持久记忆层 |
| **[claude-mem](https://github.com/thedotmack/claude-mem)** | 67K | Claude Code 会话记忆：压缩 + 自动注入 | Wiki 作为 claude-mem 的存储后端，会话记忆自然积累为 Wiki 页面 |
| **[OpenHands](https://github.com/OpenHands/OpenHands)** | 67K | 自主编程 Agent | 代码变更 → 自动更新 Wiki 中的架构文档和代码模块页面 |
| **[CrewAI](https://github.com/crewAIInc/crewAI)** | 43K | 多 Agent 协作框架 | Researcher Agent 搜索 → Writer Agent 写摘要 → Reviewer Agent 审计 |
| **[LangGraph](https://github.com/langchain-ai/langgraph)** | 23K | Stateful Agent 图状态机 | 定义 ingest → lint → graph build 的完整状态机 |
| **[Aider](https://github.com/paul-gauthier/aider)** | 30K+ | AI 结对编程 | 代码变更 → 自动反映到 Wiki 代码模块页面 |

### 8.3 整合方案

#### 方案 A：Wiki = Agent Memory Backend

```
用户对话
  │
  ▼
Agent（Claude/GPT/Gemini）
  │
  ├── 查询 Wiki 记忆（MCP read/search）
  │   └── 获取历史决策、偏好、项目上下文
  │
  ├── 生成回答
  │
  └── 写入新知识（MCP write）
      └── 新学到的东西自动积累到 Wiki
  │
  ▼
下次对话更聪明（因为 Wiki 更丰富了）
```

#### 方案 B：CrewAI 多 Agent 工作流

```python
from crewai import Agent, Task, Crew

researcher = Agent(
    role="Knowledge Researcher",
    goal="Search and gather relevant information",
    tools=[wiki_search_tool, web_search_tool],
)

writer = Agent(
    role="Knowledge Compiler",
    goal="Synthesize information into wiki pages",
    tools=[wiki_write_tool],
)

reviewer = Agent(
    role="Quality Auditor",
    goal="Check for contradictions and gaps",
    tools=[wiki_lint_tool, wiki_health_tool],
)

crew = Crew(
    agents=[researcher, writer, reviewer],
    tasks=[
        Task("Research topic X from available sources", agent=researcher),
        Task("Compile findings into wiki pages with cross-references", agent=writer),
        Task("Audit new pages for quality and consistency", agent=reviewer),
    ],
)
```

#### 方案 C：LangGraph 状态机

```
[RAW 文件变更]
      │
      ▼
[检测变更] ──→ [跳过未变更] ──→ [结束]
      │
      ▼
[Markitdown 转换]
      │
      ▼
[LLM 提取实体/概念]
      │
      ▼
[生成 Wiki 页面] ──→ [与现有页面冲突？] ──→ [标记矛盾]
      │                                          │
      ▼                                          ▼
[更新知识图谱]                              [人工审核队列]
      │
      ▼
[Health Check] ──→ [失败？] ──→ [回滚 + 告警]
      │
      ▼
[完成]
```

---

## 9. 维度八：基础设施/部署增强

### 9.1 可整合项目

| 项目 | Stars | 整合方式 | 价值 |
|---|---|---|---|
| **[Tauri](https://github.com/tauri-apps/tauri)** | 90K+ | React SPA → 桌面 App（比 Electron 轻量 10x，Rust 后端） | 桌面 App 分发，无需用户安装 Node.js/Python |
| **[Coolify](https://github.com/coollabsio/coolify)** | 40K+ | 一键部署到自托管云（自建 Vercel） | 降低部署门槛 |
| **[Litestream](https://github.com/benbjohnson/litestream)** | 10K+ | SQLite → S3 实时备份 | 配合 SQLite 搜索引擎的数据安全 |
| **[Caddy](https://github.com/caddyserver/caddy)** | 60K+ | 自动 HTTPS 反向代理 | 一行命令获得 HTTPS 域名 |
| **[Docker Compose](https://docs.docker.com/compose/)** | — | API + Viewer + MCP + Watcher 一键启动 | 标准化部署 |
| **[Cloudflare Workers](https://workers.cloudflare.com/)** | — | API 部署到边缘计算 | 全球低延迟访问 |

### 9.2 整合方案

```yaml
# docker-compose.yml（完整版）
services:
  api:
    build: .
    ports: ["8000:8000"]
    volumes: ["./raw:/app/raw", "./wiki:/app/wiki", "./graph:/app/graph"]
    environment:
      - LLM_MODEL=${LLM_MODEL}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}

  viewer:
    build: ./wiki-viewer
    ports: ["3000:3000"]
    depends_on: [api]

  mcp:
    build: .
    command: python tools/mcp_server.py
    ports: ["8080:8080"]
    volumes: ["./wiki:/app/wiki", "./graph:/app/graph"]

  watcher:
    build: .
    command: python tools/watcher.py
    volumes: ["./raw:/app/raw"]
    depends_on: [api]

  bot:
    build: .
    command: python tools/telegram_bot.py
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
    depends_on: [api]
```

---

## 10. 整合优先级矩阵

按「独特性 × 可行性 × 用户价值」排序：

| 优先级 | 整合方向 | 对标项目 | 预估工作量 | 独特性 |
|---|---|---|---|---|
| **🔴 P0** | Telegram Bot | hermes-agent | 1 周 | ⭐⭐⭐ |
| **🔴 P0** | Jina Reader URL 捕获 | Jina Reader | 3 天 | ⭐⭐⭐ |
| **🔴 P0** | n8n/GitHub Action 自动化 | n8n 模板 | 1 周 | ⭐⭐⭐ |
| **🔴 P0** | Docker Compose 一键部署 | Coolify | 3 天 | ⭐⭐ |
| **🟡 P1** | 浏览器 Web Clipper 扩展 | Karakeep | 2 周 | ⭐⭐⭐⭐ |
| **🟡 P1** | 思维导图视图（Markmap） | NoteDiscovery | 1 周 | ⭐⭐⭐ |
| **🟡 P1** | PWA 离线浏览 | — | 3 天 | ⭐⭐ |
| **🟡 P1** | CrewAI 多 Agent 工作流 | CrewAI | 2 周 | ⭐⭐⭐⭐ |
| **🟢 P2** | Y.js/Tiptap 协同编辑 | CollabMD | 3 周 | ⭐⭐⭐⭐⭐ |
| **🟢 P2** | 知识时间线 | — | 1 周 | ⭐⭐⭐⭐ |
| **🟢 P2** | Tauri 桌面 App | SwarmVault | 2 周 | ⭐⭐⭐ |
| **🟢 P2** | 桑基图（知识流动） | — | 1 周 | ⭐⭐⭐⭐ |
| **🔵 P3** | Zotero/arXiv 学术集成 | — | 3 周 | ⭐⭐⭐ |
| **🔵 P3** | 微信小程序 | — | 4 周 | ⭐⭐⭐⭐ |
| **🔵 P3** | Sigma.js 大规模图谱 | — | 1 周 | ⭐⭐ |
| **🔵 P3** | Semantic Scholar 引用图谱 | — | 2 周 | ⭐⭐⭐ |

---

## 11. 最具颠覆性的 3 个整合方向

### 🧠 方向一：Wiki = Agent Memory（Agent 的大脑）

**理念**：Wiki 不只是"知识库"，而是 AI Agent 的**持久记忆层**。

```
传统模式：Agent 对话 → 结束 → 遗忘一切
新模式：  Agent 对话 → 查询 Wiki 记忆 → 学习新知识 → 写入 Wiki → 永不遗忘
```

**为什么是颠覆性的**：
- claude-mem 67K star 证明"跨会话记忆"是刚需
- 当前所有竞品的 Wiki 都是"给人类看的"，没有一个是"给 Agent 用的大脑"
- 组合 MCP Server + Wiki → 任何 Agent 都可以接入这个记忆层

**实现路径**：
1. MCP Server 暴露 `search`/`read`/`write` → Agent 可以读写 Wiki
2. 新增 `wiki/memory/` 目录 → Agent 的会话摘要自动存入
3. 新增 Context Packs → Agent 可以快速加载相关上下文

### 👥 方向二：人机实时协同编辑

**理念**：用户在编辑器中写笔记，Agent 通过 MCP 同时在同一个文档中补充内容。类似 Google Docs 的实时协作，但参与者之一是 AI。

```
传统模式：Agent 写完 → 人看 → 人改 → Agent 再写
新模式：  人和 Agent 同时编辑 → 实时看到对方的修改 → 无冲突（CRDT）
```

**为什么是颠覆性的**：
- 所有竞品（llmwiki、SwarmVault、wikillm）都是"Agent 写、人读"
- 人机协同编辑 = **知识管理的 Google Docs 时刻**
- Agent 的修改用蓝色标记，人类的用绿色，互相可见

**实现路径**：
1. Tiptap 编辑器 + Y.js CRDT
2. WebSocket Server 共享编辑状态
3. MCP write 操作写入 Y.Doc（而非直接写文件）

### 🔗 方向三：全链路自动化知识流水线

**理念**：从信息采集到知识输出的完整自动化管道。

```
信息源（浏览器/RSS/邮件/GitHub/arXiv/Telegram）
    │
    ▼ 自动采集
Web Clipper / n8n Workflow / GitHub Action / Telegram Bot
    │
    ▼ 自动转换
Jina Reader / markitdown
    │
    ▼ 自动编译
ingest（LLM 提取实体/概念/关系）
    │
    ▼ 自动积累
Wiki（entity/concept/source 页面 + 知识图谱）
    │
    ▼ 自动输出
仪表盘 / 报告 / 幻灯片 / 每日摘要 / Agent 记忆
```

**为什么是颠覆性的**：
- 用户只需关注"思考和决策"
- 所有中间环节（采集、转换、编译、维护）完全自动化
- 知识像水一样自然流入和流出 Wiki

---

## 12. 参考资源索引

### 信息采集

| 项目 | URL |
|---|---|
| Karakeep | https://github.com/karakeep/hoarder |
| stash-bookmark | https://github.com/ayoub9360/stash-bookmark |
| bookmark-is-learned | https://github.com/Luis02051/bookmark-is-learned |
| LocalForge Bookmarks | https://github.com/longregen/bookmarks |
| Jina Reader | https://jina.ai/reader/ |

### 自动化工作流

| 项目 | URL |
|---|---|
| n8n | https://n8n.io |
| Dify | https://github.com/langgenius/dify |
| Activepieces | https://github.com/activepieces/activepieces |
| Huginn | https://github.com/huginn/huginn |
| n8n GitHub QA Bot | https://xindoo.blog.csdn.net/article/details/153917094 |

### 协同编辑

| 项目 | URL |
|---|---|
| Y.js | https://github.com/yjs/yjs |
| Tiptap | https://github.com/ueberdosis/tiptap |
| HedgeDoc | https://github.com/hedgedoc/hedgedoc |
| CollabMD | https://news.ycombinator.com/item?id=47421425 |
| Etherpad | https://github.com/ether/etherpad |

### 可视化

| 项目 | URL |
|---|---|
| Markmap | https://markmap.js.org/ |
| Sigma.js | https://github.com/jacomyal/sigma.js |
| React Flow | https://github.com/xyflow/xyflow |
| Cytoscape.js | https://github.com/cytoscape/cytoscape.js |
| vis-timeline | https://github.com/visjs/vis-timeline |

### AI Agent

| 项目 | URL |
|---|---|
| hermes-agent | https://github.com/NousResearch/hermes-agent |
| claude-mem | https://github.com/thedotmack/claude-mem |
| OpenHands | https://github.com/OpenHands/OpenHands |
| CrewAI | https://github.com/crewAIInc/crewAI |
| LangGraph | https://github.com/langchain-ai/langgraph |

### 部署

| 项目 | URL |
|---|---|
| Tauri | https://github.com/tauri-apps/tauri |
| Coolify | https://github.com/coollabsio/coolify |
| Litestream | https://github.com/benbjohnson/litestream |
| Caddy | https://github.com/caddyserver/caddy |

---

## 附录：知识全栈架构愿景

```
┌────────────────────────────────────────────────────────────────────┐
│                        用户界面层                                   │
│  Wiki Viewer (React) │ 桌面 App (Tauri) │ PWA │ Telegram Bot      │
│  移动 App (Capacitor) │ 微信小程序 │ 浏览器扩展                      │
├────────────────────────────────────────────────────────────────────┤
│                        可视化层                                     │
│  知识图谱 (vis.js/Sigma.js) │ 思维导图 (Markmap) │ 时间线 (D3.js)   │
│  桑基图 │ 桑基图 │ 引用图谱 │ 健康仪表盘                              │
├────────────────────────────────────────────────────────────────────┤
│                        协同编辑层                                   │
│  Tiptap 编辑器 │ Y.js CRDT │ WebSocket │ 人机协同                   │
├────────────────────────────────────────────────────────────────────┤
│                        API 层（FastAPI）                             │
│  REST API │ SSE Chat │ MCP Server │ Webhook │ GraphQL（可选）       │
├────────────────────────────────────────────────────────────────────┤
│                        知识编译层                                    │
│  Ingest │ Query │ Lint │ Health │ Build Graph │ Heal │ Refresh     │
│  LLM Gateway (litellm) │ Search Engine (FTS5 + Embeddings)        │
├────────────────────────────────────────────────────────────────────┤
│                        存储层                                       │
│  raw/ (不可变源文件) │ wiki/ (编译后的知识) │ graph/ (图谱数据)       │
│  SQLite (搜索索引) │ 嵌入向量 (可选 Ollama)                          │
├────────────────────────────────────────────────────────────────────┤
│                        自动化层                                     │
│  Watcher (文件监控) │ n8n (工作流) │ GitHub Actions │ Cron           │
│  Web Clipper │ RSS Monitor │ arXiv Monitor │ Telegram Bot           │
├────────────────────────────────────────────────────────────────────┤
│                        Agent 集成层                                 │
│  MCP Server │ CrewAI │ LangGraph │ claude-mem │ hermes-agent        │
│  Claude Code Skills │ Aider │ OpenHands                             │
└────────────────────────────────────────────────────────────────────┘
```
