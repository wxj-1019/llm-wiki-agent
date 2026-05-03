# LLM Wiki Agent — 竞品分析与发展路线图

> 版本：v2.0 | 日期：2026-05-03 | 搜索范围：GitHub/NPM/PyPI/技术博客 110+ 项目

---

## 目录

1. [搜索范围与方法论](#1-搜索范围与方法论)
2. [竞品全景矩阵](#2-竞品全景矩阵)
3. [Tier-1 竞品深度分析](#3-tier-1-竞品深度分析)
4. [技术栈趋势与行业洞察](#4-技术栈趋势与行业洞察)
5. [SWOT 分析](#5-swot-分析)
6. [功能差距与优先级排序](#6-功能差距与优先级排序)
7. [技术升级路线图](#7-技术升级路线图)
8. [独特创新方向（竞品空白区）](#8-独特创新方向竞品空白区)
9. [参考资源索引](#9-参考资源索引)

---

## 1. 搜索范围与方法论

### 搜索维度

| 维度 | 搜索关键词 | 数据源 |
|---|---|---|
| LLM Wiki 直接竞品 | `llm wiki`, `llm-wiki`, `karpathy wiki` | GitHub, NPM |
| 知识图谱 + AI | `knowledge graph LLM agent`, `GraphRAG`, `LightRAG` | GitHub, PyPI |
| 个人知识管理 | `personal knowledge management AI`, `second brain`, `PKM` | GitHub |
| MCP Server 生态 | `MCP server knowledge base`, `MCP tools` | NPM, PyPI, Elastic Blog |
| Agent 框架集成 | `agent framework`, `Claude Code skill`, `agent memory` | GitHub, You.com |
| 笔记/文档工具 | `markdown wiki self-hosted`, `note-taking AI`, `Obsidian` | GitHub, ProductHunt |

### 筛选标准

- GitHub Stars > 100 或 NPM 周下载 > 500
- 最近 6 个月有活跃提交
- 与本项目功能重叠度 > 30%

---

## 2. 竞品全景矩阵

### 2.1 直接竞品（Karpathy LLM Wiki 模式）

| 项目 | ⭐ Stars | 语言 | 定位 | 核心差异化 |
|---|---|---|---|---|
| **[lucasastorian/llmwiki](https://github.com/lucasastorian/llmwiki)** | 656 | TS + Python | 云端 SaaS | Next.js + FastAPI + Supabase + MCP Server + OAuth 多租户 + S3 存储 |
| **[swarmclawai/SwarmVault](https://github.com/swarmclawai/swarmvault)** | 263 | TypeScript | CLI 工具链 | 桌面 App + CLI + 混合搜索 + 16 种 Agent 集成 + MCP + 分享卡片 |
| **[Berkay2002/wikillm](https://github.com/Berkay2002/wikillm)** | 新 | TypeScript | Claude Code 插件 | 7 个 Agent Skill + Obsidian CLI + Marp 幻灯片 + 定时自动化 |
| **[safishamsi/graphify](https://github.com/safishamsi/graphify)** | 高 | Python | Claude Code Skill | tree-sitter AST + Leiden 聚类 + 诚实审计 + 71x Token 压缩 |
| **[refactoringhq/tolaria](https://github.com/refactoringhq/tolaria)** | 4,936 | TypeScript | 桌面 App | Markdown 知识库管理桌面应用 |
| **[karpathy/llm-wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)** | 27,538 | Gist 模板 | 理念文档 | Karpathy 原始 Gist，5953 forks，生态源头 |
| **[personal-ai-skills](https://www.npmjs.com/package/personal-ai-skills)** | NPM | TypeScript | 跨 Agent 配置 | 统一配置层（Claude Code/Cursor/Copilot/Codex/Gemini/Windsurf） |
| **[ai-memex-cli](https://www.npmjs.com/package/ai-memex-cli)** | NPM | TypeScript | Agent Memex | CLI + 会话蒸馏 + watch 守护进程 + 多 Agent 支持 |

### 2.2 相关生态项目（知识图谱 + RAG）

| 项目 | ⭐ Stars | 核心能力 |
|---|---|---|
| **[HKUDS/LightRAG](https://github.com/HKUDS/LightRAG)** | 14,100+ | 轻量 GraphRAG：双路检索（图遍历 + 向量），3 分钟索引 500 页文档，$0.50 成本 |
| **[microsoft/graphrag](https://github.com/microsoft/graphrag)** | 50,000+ | 微软 GraphRAG：社区检测 + 全局摘要，26% 答案全面性提升，但索引成本 10-40x |
| **[TencentCloudADP/youtu-graphrag](https://github.com/TencentCloudADP/youtu-graphrag)** | 1,200+ | 腾讯优图：33.6% Token 成本降低 + 16.62% 准确率提升 |
| **[graphrag-lite](https://pypi.org/project/graphrag-lite/)** | PyPI | ~600 行 Python 实现，4 种查询模式（local/global/mix/naive） |
| **[ChristopherLyon/graphrag-workbench](https://github.com/ChristopherLyon/graphrag-workbench)** | 新 | 3D 知识图谱可视化 + Microsoft GraphRAG 前端 |
| **[knowledge-mcp](https://pypi.org/project/knowledge-mcp/)** | PyPI | MCP Server + LightRAG 引擎：文档处理 → 知识图谱 → MCP 查询 |
| **[agentic-knowledge-mcp](https://www.npmjs.com/package/agentic-knowledge-mcp)** | NPM | Agentic Search：零基础设施，grep + 文件读取替代 RAG |

### 2.3 笔记/知识管理工具

| 项目 | ⭐ Stars | 核心能力 |
|---|---|---|
| **[gamosoft/NoteDiscovery](https://github.com/gamosoft/NoteDiscovery)** | 2,500 | 自托管笔记 App + 图谱视图 + MCP Server + LaTeX + 绘图 + 20+ i18n |
| **[UnforbiddenYet/cogninote](https://github.com/UnforbiddenYet/cogninote)** | 新 | AI-first PKM：LightRAG 知识图谱 + 自然语言问答 + 自托管 |
| **[ChrisBrooksbank/brain2](https://github.com/ChrisBrooksbank/brain2)** | 新 | 本地 PWA + Transformers.js 浏览器内嵌入 + 离线语义搜索 |
| **[eggcuptraceelement660/gbrain-openclaw](https://github.com/eggcuptraceelement660/gbrain-openclaw)** | 新 | SQLite + FTS5 + 向量嵌入 + MCP 集成的 Agent Memory |
| **[Trafexofive/second-brain-stack](https://github.com/Trafexofive/second-brain-stack)** | 新 | Python 微服务架构 + Docker + FTS5 + 向量搜索 + 知识图谱 |

### 2.4 2026 Agent 生态趋势项目

| 项目 | ⭐ Stars | 核心能力 |
|---|---|---|
| **NousResearch/hermes-agent** | 116,863 | 自进化 AI Agent：持久记忆 + GEPA 引擎 + 多平台 + 子代理并行 |
| **thedotmack/claude-mem** | 67,536 | Claude Code 会话记忆：压缩 + 自动注入下次会话 |
| **abhigyanpatwari/GitNexus** | 29,385 | GitHub 仓库 → 浏览器知识图谱 |
| **zilliztech/claude-context** | 9,398 | 代码库 → Claude Code 上下文的 MCP Server |
| **huggingface/ml-intern** | 6,289 | 读论文 + 训练模型 + 部署的 ML Agent |

---

## 3. Tier-1 竞品深度分析

### 3.1 llmwiki（lucasastorian）

**架构**：Next.js 16 + FastAPI + Supabase + S3 + MCP Server

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ Next.js 16  │──▶│   FastAPI   │──▶│  Supabase   │
│  Frontend   │   │   Backend   │   │ (Postgres)  │
└─────────────┘   └──────┬──────┘   └─────────────┘
                         │
                  ┌──────┴──────┐
                  │  MCP Server │◀──── Claude.ai
                  └─────────────┘
```

**关键特性**：
- 5 个 MCP 工具：`guide`、`search`（PGroonga）、`read`（PDF + 页码 + 图片）、`write`（str_replace + append）、`delete`
- Supabase RLS 多租户隔离
- TUS 协议断点续传上传
- Mistral OCR 引擎
- 独立 converter 微服务（LibreOffice 沙箱）
- Docker Compose 自托管

**对我们的启示**：
- MCP 工具设计值得借鉴（特别是 `read` 的页码/图片支持）
- 多租户架构对团队场景有价值
- OCR 能力是文档处理的刚需

### 3.2 SwarmVault

**架构**：Monorepo + pnpm workspace + 桌面 App + CLI

**关键特性**：
- 一键 `swarmvault scan ./path` → 知识图谱
- 30+ 输入格式（含代码仓库 tree-sitter AST）
- 混合搜索：SQLite FTS5 + 语义嵌入（可选 Ollama 本地）
- 12 个 Agent 集成（Claude Code, Cursor, Copilot, Codex, Gemini 等）
- Agent Memory Ledger：`memory start/update/resume` 跨会话持久化
- Context Packs：token-bounded 上下文包
- 分享套件：SVG 卡片 + HTML 预览 + Markdown 文本
- 审批队列：`compile --approve` 阶段化审核
- 完全离线模式（heuristic provider）

**对我们的启示**：
- **混合搜索**是必须跟进的方向
- **Agent Memory** 和 **Context Packs** 是差异化功能
- **审批队列**防止 LLM 幻觉扩散的机制值得学习
- 桌面 App 分发降低安装门槛

### 3.3 NoteDiscovery

**架构**：Go 后端 + React 前端 + MCP Server + SQLite

**关键特性**：
- 自包含 Docker 部署
- 内置绘图编辑器（drawing-*.png）
- 20+ i18n 语言
- LaTeX/MathJax 公式
- 交互式图谱视图
- MCP Server（backlink 工具）
- 多主题支持
- HTML 导出 + 打印

**对我们的启示**：
- 绘图编辑器是差异化功能
- 丰富的 i18n 支持证明全球需求
- MCP Server 是标配

### 3.4 GraphRAG 生态

**四种 GraphRAG 类型**（来源：paperclipped.de 分析）：

| 类型 | 描述 | 成本 | 适用场景 |
|---|---|---|---|
| Type 1: 图增强向量搜索 | 向量搜索 + 元数据/实体过滤 | 1x | 实体过滤需求 |
| Type 2: 图引导检索 | 图遍历 + 向量混合 | 3-5x | 多跳推理 |
| Type 3: 图基摘要（微软 GraphRAG） | 社区检测 + 全局摘要 | 10-40x | 全局分析 |
| Type 4: 时序知识图谱（Graphiti） | 动态时间线 + Agent 记忆 | 5-10x | Agent 长期记忆 |

**LightRAG 关键数据**：
- 索引 500 页文档：~3 分钟，~$0.50
- 查询延迟：~80ms（比标准 RAG 快 30%）
- 性能：微软 GraphRAG 的 70-90%，成本仅 1/100

**对我们的启示**：
- 当前 `build_graph.py` + networkx Louvain 已实现 Type 1
- 升级到 Type 2（图遍历 + 向量混合）是最佳性价比路径
- LightRAG 是集成首选（轻量、低成本、高质量）

---

## 4. 技术栈趋势与行业洞察

### 4.1 2026 开源趋势

来源：GitHub 趋势榜、掘金、you.com 分析

| 趋势 | 描述 | 影响 |
|---|---|---|
| **Agent 从工具变成员** | hermes-agent 11.6 万 star，AI 成为团队正式角色 | Wiki 系统需要 Agent-native 接口 |
| **本地部署成刚需** | 隐私合规推动端侧推理，LiteRT-LM 8000+ star | 离线能力是差异化优势 |
| **MCP 成为标配** | 340+ MCP Server 生态，微软/Google/AWS 官方支持 | MCP 集成是最高优先级 |
| **Agentic Search 替代 RAG** | 不用向量数据库，用 grep + 文件读取 + LLM 导航 | 对当前"编译一次"模式是互补而非替代 |
| **Token 压缩** | rtk-ai CLI 60-90% Token 削减，Graphify 71x 压缩 | Context Packs 功能有真实需求 |
| **GraphRAG 成熟化** | 从研究走向生产，4 种类型各有明确场景 | 知识图谱从可视化走向查询引擎 |
| **多 Agent 协作** | CrewAI 4.3 万 star，AutoGen 5.3 万 star | Wiki 需要支持多 Agent 同时读写 |

### 4.2 技术栈对比

| 技术选择 | 竞品主流方案 | 我们当前方案 | 建议 |
|---|---|---|---|
| **后端** | FastAPI（6/8 竞品） | FastAPI ✅ | 保持 |
| **前端** | Next.js（3/8）或 React SPA | React SPA ✅ | 保持，考虑 SSR 优化 SEO |
| **数据库** | Supabase/Postgres（云端）或 SQLite（本地） | 纯文件系统 | 考虑 SQLite 增强搜索 |
| **搜索** | FTS5 + 向量嵌入 | Fuse.js 关键词 | 升级为混合搜索 |
| **知识图谱** | LightRAG / vis.js / Neo4j | networkx + vis.js | 集成 LightRAG |
| **LLM 网关** | litellm / 直接 API | litellm ✅ | 保持，这是我们的优势 |
| **文件转换** | markitdown / LibreOffice | markitdown ✅ | 保持 |
| **MCP** | FastMCP SDK | 规划中 | 尽快实现 |
| **部署** | Docker / 桌面 App / NPM CLI | 手动启动 | Docker Compose 一键部署 |

---

## 5. SWOT 分析

### Strengths（优势）

| 优势 | 竞品对比 |
|---|---|
| **多 LLM 支持**（litellm） | 唯一真正支持任意 LLM 后端的项目（竞品多锁定 Claude 或 OpenAI） |
| **独立 React SPA** | 不依赖 Obsidian，自包含部署 |
| **知识图谱可视化**（vis.js + Louvain） | 大多数竞品没有或依赖 Obsidian |
| **20+ 文件格式**（markitdown） | 最全面的格式支持之一 |
| **中文 i18n** | 唯一原生支持中文的竞品 |
| **Chat/Q&A**（SSE 流式） | 直接竞品中少数有内置对话的 |
| **纯文件系统** | 零依赖，git 友好 |

### Weaknesses（劣势）

| 劣势 | 竞品差距 |
|---|---|
| **无 MCP Server** | llmwiki + SwarmVault + NoteDiscovery 都已实现 |
| **无自动 Ingest** | SwarmVault 有 watch daemon，wikillm 有 cron |
| **无语义搜索** | SwarmVault/Second Brain Stack 有嵌入搜索 |
| **无导出/分享** | SwarmVault 有 SVG 卡片 + Neo4j，wikillm 有 Marp |
| **无 CLI 工具** | SwarmVault/wikillm/ai-memex 都有 CLI |
| **无测试套件** | llmwiki 有 pytest + CI/CD |
| **无 Docker 部署** | llmwiki/Second Brain Stack 有 docker-compose |
| **无 Agent 集成** | SwarmVault 有 16 种，wikillm 有 7 个 Skill |

### Opportunities（机会）

| 机会 | 描述 |
|---|---|
| **MCP 生态爆发** | 340+ MCP Server，成为知识管理 MCP Server 可以进入主流 |
| **GraphRAG 成熟** | LightRAG 等轻量方案降低集成门槛 |
| **中文市场空白** | 没有中文原生 LLM Wiki 竞品 |
| **多 LLM 差异化** | litellm 支持是独家优势，可以吸引非 Claude 用户 |
| **Agent Memory 需求** | claude-mem 6.7 万 star 证明跨会话记忆是刚需 |
| **本地优先趋势** | 隐私合规推动自托管需求 |

### Threats（威胁）

| 威胁 | 影响 |
|---|---|
| **SwarmVault 全栈覆盖** | CLI + 桌面 App + MCP + 搜索 + 分享，功能最全 |
| **llmwiki SaaS 模式** | 零安装体验，llmwiki.app 即用 |
| **Graphify 71x Token 压缩** | 对大规模知识库有显著成本优势 |
| **Agentic Search 范式** | 如果 Agent 直接 grep 文件就够了，编译 wiki 的价值需要重新证明 |

---

## 6. 功能差距与优先级排序

### 6.1 关键差距矩阵

按「竞品覆盖率 × 用户价值 × 实现难度」排序：

| # | 功能 | 竞品覆盖率 | 用户价值 | 实现难度 | 优先级 |
|---|---|---|---|---|---|
| G1 | **MCP Server** | 4/6 直接竞品 | ⭐⭐⭐⭐⭐ | 中 | **P0-紧急** |
| G2 | **自动 Ingest（Watch 模式）** | 3/6 | ⭐⭐⭐⭐ | 低 | **P0-紧急** |
| G3 | **语义/混合搜索** | 4/6 | ⭐⭐⭐⭐⭐ | 中 | **P0-紧急** |
| G4 | **Docker 一键部署** | 3/6 | ⭐⭐⭐⭐ | 低 | **P1-高** |
| G5 | **导出/分享功能** | 3/6 | ⭐⭐⭐ | 中 | **P1-高** |
| G6 | **Agent Memory Ledger** | 2/6 | ⭐⭐⭐⭐ | 中 | **P1-高** |
| G7 | **Context Packs** | 1/6 | ⭐⭐⭐⭐ | 中 | **P1-高** |
| G8 | **CLI 工具** | 4/6 | ⭐⭐⭐ | 中 | **P2-中** |
| G9 | **代码仓库感知（tree-sitter）** | 2/6 | ⭐⭐⭐ | 高 | **P2-中** |
| G10 | **审批队列** | 1/6 | ⭐⭐⭐ | 中 | **P2-中** |
| G11 | **桌面 App（Tauri）** | 2/6 | ⭐⭐⭐ | 高 | **P3-低** |
| G12 | **多租户/协作** | 1/6 | ⭐⭐ | 高 | **P3-低** |
| G13 | **语音输入（Whisper）** | 1/6 | ⭐⭐ | 中 | **P3-低** |

---

## 7. 技术升级路线图

### Phase 1：生态接入（2-3 周）

**目标**：打通 Agent 生态入口，实现自动化工作流

#### 1.1 MCP Server 实现

```
tools/mcp_server.py          # FastMCP SDK
├── wiki_search(query, type)  # 搜索 wiki 页面
├── wiki_read(path)           # 读取页面内容（含 frontmatter）
├── wiki_write(path, content) # 创建/更新页面（str_replace + append）
├── wiki_delete(path)         # 归档页面
├── wiki_list(type)           # 列出页面（支持类型过滤）
├── wiki_graph_query(node)    # 图谱邻居查询
└── wiki_health()             # 健康状态检查
```

参考实现：llmwiki 的 5 个工具 + knowledge-mcp 的 LightRAG 集成

#### 1.2 Watch 自动 Ingest

```
tools/watcher.py              # watchdog 文件监控
├── 监控 raw/ 目录变化
├── 新文件 → 自动 markitdown 转换 → ingest
├── 文件修改 → refresh
├── 文件删除 → 标记归档
└── 防抖 5 秒（避免批量操作触发大量 ingest）
```

参考实现：SwarmVault 的 `watch --daemon` + ai-memex 的 watch 守护进程

#### 1.3 Docker Compose

```yaml
# docker-compose.yml
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
```

### Phase 2：搜索升级（3-4 周）

**目标**：从关键词搜索升级为语义 + 关键词混合搜索

#### 2.1 SQLite FTS5 全文搜索

```python
# tools/search_engine.py
import sqlite3

class WikiSearchEngine:
    def __init__(self, db_path="state/search.db"):
        self.conn = sqlite3.connect(db_path)
        self._init_fts()

    def _init_fts(self):
        self.conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS wiki_pages
            USING fts5(title, content, type, tags, path,
                       tokenize='porter unicode61')
        """)

    def index_page(self, path, title, content, type, tags):
        self.conn.execute("""
            INSERT OR REPLACE INTO wiki_pages VALUES(?,?,?,?,?)
        """, (title, content, type, " ".join(tags), path))

    def search(self, query, limit=20):
        cursor = self.conn.execute("""
            SELECT path, title, type, rank
            FROM wiki_pages
            WHERE wiki_pages MATCH ?
            ORDER BY rank
            LIMIT ?
        """, (query, limit))
        return cursor.fetchall()
```

#### 2.2 语义嵌入（可选 Ollama 本地）

```python
# 可选：Ollama 本地嵌入（零 API 成本）
# 或：litellm.embedding() 使用远程 API
def embed_text(text: str) -> list[float]:
    response = litellm.embedding(
        model="ollama/nomic-embed-text",
        input=[text],
        api_base="http://localhost:11434"
    )
    return response.data[0]["embedding"]
```

#### 2.3 混合搜索（关键词 + 语义融合）

```python
def hybrid_search(query: str, limit: int = 20) -> list[dict]:
    fts_results = fts_search(query, limit * 2)
    semantic_results = semantic_search(query, limit * 2)
    merged = reciprocal_rank_fusion(fts_results, semantic_results, k=60)
    return merged[:limit]
```

### Phase 3：Agent 增强（3-4 周）

**目标**：让 Wiki 成为 Agent 的持久记忆层

#### 3.1 Agent Memory Ledger

```
wiki/
└── memory/
    ├── session-2026-05-03-001.md   # 会话记录
    ├── decisions.md                 # 决策日志
    └── context-packs/
        ├── pack-auth-refactor.md    # 打包的上下文
        └── pack-api-design.md
```

```python
# tools/memory.py
class AgentMemory:
    def start(self, goal, target=None):
        """开始新任务，创建记忆文件"""

    def update(self, notes, decisions=None, changed_paths=None):
        """更新任务进度"""

    def finish(self, summary):
        """完成任务，写入摘要"""

    def resume(self, session_id):
        """恢复之前的任务上下文"""
```

#### 3.2 Context Packs

```python
# tools/context.py
class ContextPackBuilder:
    def build(self, goal: str, target: str = None, budget: int = 8000):
        """构建 token-bounded 上下文包"""
        # 1. 图谱遍历找到相关节点
        # 2. 混合搜索补充
        # 3. 按新鲜度 + 相关度排序
        # 4. 截断到 budget tokens
        # 5. 添加引用来源
        pass

    def list_packs(self):
        """列出所有已保存的上下文包"""

    def show(self, pack_id):
        """回放指定上下文包"""
```

### Phase 4：输出与分发（2-3 周）

**目标**：增强知识输出能力

#### 4.1 导出功能

- **图谱快照**：SVG/PNG 导出（html2canvas 或 vis.js 内置）
- **Wiki PDF**：完整 wiki 或选定页面导出为 PDF
- **HTML 单文件**：自包含 HTML wiki 快照

#### 4.2 分享功能

- **SVG 分享卡片**：图谱概览 + 统计数据（参考 SwarmVault）
- **Markdown 分享文本**：适合社交媒体发布的摘要
- **Bundle 分享**：HTML + SVG + JSON 打包

#### 4.3 幻灯片生成（参考 wikillm Marp）

- 从 wiki 内容自动生成演示文稿
- 支持概念页、对比页、时间线页等模板

---

## 8. 独特创新方向（竞品空白区）

以下是所有竞品均未实现的功能方向，可以作为差异化突破点：

### 8.1 Wiki Timeline（知识时间线）

**描述**：将 `wiki/log.md` 的操作日志转化为可视化时间线

**竞品空白**：所有竞品都只有操作日志文本，没有可视化时间线

**实现思路**：
- 从 `log.md` 解析每次 ingest/query/lint 的元数据
- D3.js / vis-timeline 渲染交互式时间线
- 支持按日期范围、操作类型、实体/概念过滤
- 点击事件节点可查看该次操作的详细变更

### 8.2 知识健康仪表盘

**描述**：将 health + lint + graph report 整合成实时仪表盘

**竞品空白**：竞品的健康检查都是命令行输出，没有可视化仪表盘

**实现思路**：
- 新增 `/dashboard` 路由
- 展示：页面总数、实体/概念比、孤立节点率、矛盾数、最近活跃度
- 雷达图：完整性、一致性、连通性、新鲜度、多样性
- 趋势图：随时间的知识库增长曲线

### 8.3 AI 每日摘要

**描述**：每天 AI 自动生成 wiki 变化摘要，推送到聊天页面

**竞品空白**：无竞品实现自动化的每日知识摘要

**实现思路**：
- Cron 或 watch 模式触发
- 对比 `git diff HEAD~1` 或 log.md 新增条目
- LLM 生成人类可读的每日变化摘要
- 支持邮件/Webhook/Telegram 推送

### 8.4 Wiki Diff 可视化

**描述**：对比两个时间点的 wiki 状态，可视化知识变化

**竞品空白**：竞品只有 git log 文本对比，没有语义级别的 diff

**实现思路**：
- 基于图谱结构对比：新增/删除/修改的节点和边
- 高亮显示变化的社区结构
- 展示实体/概念的演变路径

### 8.5 协作式图谱编辑

**描述**：允许用户在图谱上手动拖拽/连线，AI 补充语义关系

**竞品空白**：所有竞品的图谱都是只读的，没有交互编辑能力

**实现思路**：
- vis.js 已支持拖拽节点
- 新增"创建关系"模式：拖拽连线 → 选择关系类型 → AI 验证
- 用户标记的关系标记为 `MANUAL`（最高置信度）
- AI 可以建议关系但需要用户确认

### 8.6 知识图谱查询语言

**描述**：提供类 Cypher 的图查询语言，支持复杂推理

**竞品空白**：只有 SwarmVault 有 `graph query/path/explain`，但不是标准查询语言

**实现思路**：
```cypher
// 示例查询：找到所有与 OpenAI 相关的概念
MATCH (e:Entity {name: "OpenAI"})-[:RELATES_TO]->(c:Concept)
RETURN c.name, c.summary

// 示例查询：两个实体之间的最短路径
MATCH path = shortestPath(
  (a:Entity {name: "GPT-4"})-[*..5]-(b:Entity {name: "RAG"})
)
RETURN path
```

### 8.7 多 Wiki 联邦

**描述**：支持多个 Wiki 仓库之间共享实体和概念

**竞品空白**：无竞品支持跨 Wiki 互联

**实现思路**：
- 每个 Wiki 有唯一 ID
- 实体/概念可以标记为"联邦共享"
- 跨 Wiki 的 wikilink 格式：`[[other-wiki::EntityName]]`
- 联邦目录：注册和发现其他 Wiki

---

## 9. 参考资源索引

### 竞品项目

| 项目 | URL |
|---|---|
| llmwiki | https://github.com/lucasastorian/llmwiki |
| SwarmVault | https://github.com/swarmclawai/swarmvault |
| wikillm | https://github.com/Berkay2002/wikillm |
| Graphify | https://github.com/safishamsi/graphify |
| NoteDiscovery | https://github.com/gamosoft/NoteDiscovery |
| Tolaria | https://github.com/refactoringhq/tolaria |
| personal-ai-skills | https://www.npmjs.com/package/personal-ai-skills |
| cogninote | https://github.com/UnforbiddenYet/cogninote |
| brain2 | https://github.com/ChrisBrooksbank/brain2 |
| gbrain-openclaw | https://github.com/eggcuptraceelement660/gbrain-openclaw |
| Second Brain Stack | https://github.com/Trafexofive/second-brain-stack |
| GitNexus | https://github.com/abhigyanpatwari/GitNexus |
| claude-context | https://github.com/zilliztech/claude-context |

### GraphRAG 生态

| 项目 | URL |
|---|---|
| Microsoft GraphRAG | https://github.com/microsoft/graphrag |
| LightRAG | https://github.com/HKUDS/LightRAG |
| Youtu-GraphRAG | https://github.com/TencentCloudADP/youtu-graphrag |
| graphrag-lite | https://pypi.org/project/graphrag-lite/ |
| GraphRAG Workbench | https://github.com/ChristopherLyon/graphrag-workbench |
| Graph RAG in Production | https://www.paperclipped.de/en/blog/graph-rag-production |

### MCP 生态

| 项目 | URL |
|---|---|
| MCP 官方 | https://modelcontextprotocol.io/ |
| knowledge-mcp | https://pypi.org/project/knowledge-mcp/ |
| agentic-knowledge-mcp | https://www.npmjs.com/package/agentic-knowledge-mcp |
| MCP Server 目录 | https://www.hexmos.com/freedevtools/mcp/ |
| Elastic MCP 参考 | https://www.elastic.co/search-labs/blog/agent-builder-mcp-reference-architecture-elasticsearch |

### 行业分析

| 资源 | URL |
|---|---|
| Karpathy 原始 Gist | https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f |
| 2026 Agentic Tools | https://you.com/resources/popular-agentic-open-source-tools-2026 |
| 2026 GitHub 热门项目 | https://juejin.cn/post/7630730075692122175 |
| GraphRAG 技术分析 | https://gitcode.csdn.net/69dce22f54b52172bc69480b.html |
| awesome-ai-agents-2026 | https://github.com/caramaschiHG/awesome-ai-agents-2026 |
| 零成本知识图谱 | https://lqdev.me/resources/ai-memex/blog-post-zero-cost-knowledge-graph-from-markdown |

---

## 附录：实施优先级总结

```
Phase 1（2-3 周）→ MCP Server + Watch 自动 Ingest + Docker
Phase 2（3-4 周）→ 混合搜索（FTS5 + 嵌入）
Phase 3（3-4 周）→ Agent Memory + Context Packs
Phase 4（2-3 周）→ 导出/分享 + 幻灯片
Phase 5（持续）  → 独特创新（时间线、仪表盘、联邦等）
```

**核心理念**：编译一次，查询无限。让 Wiki 成为 Agent 的持久记忆层，而不是人类的阅读器。
