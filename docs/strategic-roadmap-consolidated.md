# LLM Wiki Agent — 战略路线图整合版

> 版本：v3.0 Consolidated | 日期：2026-05-04
> 来源：合并 `competitive-analysis-2025.md` + `competitor-analysis-and-roadmap.md` + `cross-domain-integration-brainstorm.md`
> 新增：2026-04 wave 竞品情报 + 依赖关系分析 + 快速获胜识别

---

## 一、方法论：如何整合三份文档

三份原始文档从不同角度提出了建议，存在以下问题：

- **重复**："语义搜索"在竞争分析和路线图中都被列为 P0
- **粒度不一**："MCP Server"在路线图是 P0，在整合脑暴中隐含在"Agent 深度集成"维度
- **遗漏关联**："Docker 部署"在路线图是 P1，但它是 MCP Server 和 Watch 模式的前提条件
- **时间冲突**：路线图建议 Phase 1（2-3 周）做 MCP + Watch + Docker，但竞争分析建议 1-2 月内做语义检索

**整合策略**：
1. 将所有建议抽取为独立条目，标注原始来源
2. 按「竞品威胁 × 用户价值 × 实现难度 × 战略契合度」四维度重新打分
3. 识别依赖关系，将阻塞项前置
4. 标记"快速获胜"（≤3 天，独立价值高）

---

## 二、完整需求清单（去重后 25 项）

### 2.1 需求总表

| # | 需求 | 来源 | 原优先级 | 新优先级 | 依赖 |
|---|------|------|---------|---------|------|
| R1 | **MCP Server 实现** | 路线图 G1 | P0-紧急 | **🔴 P0** | 无 |
| R2 | **混合搜索（FTS5 + 语义）** | 竞争#1, 路线图 G3 | P0 | **🔴 P0** | 无 |
| R3 | **Watch 自动 Ingest** | 路线图 G2, 脑暴自动化 | P0 | **🔴 P0** | Docker（推荐） |
| R4 | **前端实时同步（SSE/WebSocket）** | 竞争#3 | P0 | **🔴 P0** | Watch（可选） |
| R5 | **LLM 成本优化（缓存 + 路由）** | 竞争#2 | P0 | **🟡 P1** | 无 |
| R6 | **Docker Compose 一键部署** | 路线图 G4, 脑暴 | P1 | **🟡 P1** | 无 |
| R7 | **网页剪藏 / URL 摄入** | 竞争#4, 脑暴信息采集 | P1 | **🟡 P1** | 无 |
| R8 | **自动化工作流（n8n/GitHub Action webhook）** | 脑暴自动化 | P0 | **🟡 P1** | MCP Server |
| R9 | **导出/分享功能（SVG 卡片 / PDF / HTML）** | 路线图 G5 | P1 | **🟡 P1** | 无 |
| R10 | **Agent Memory Ledger** | 路线图 G6, 脑暴 Agent | P1 | **🟡 P1** | MCP Server |
| R11 | **Context Packs** | 路线图 G7 | P1 | **🟡 P1** | Agent Memory |
| R12 | **前端 Markdown 编辑器** | 竞争#6 | P1 | **🟡 P1** | 无 |
| R13 | **图可视化编辑（手动增删节点/边）** | 竞争#5 | P1 | **🟡 P1** | 无 |
| R14 | **PWA 离线浏览** | 脑暴移动端 | P1 | **🟢 P2** | 无 |
| R15 | **测试套件（pytest + vitest）** | 竞争#7, 路线图 | P1 | **🟢 P2** | 无 |
| R16 | **Telegram Bot** | 脑暴移动端 | P0 | **🟢 P2** | API Server |
| R17 | **CLI 工具统一** | 路线图 G8 | P2 | **🟢 P2** | 无 |
| R18 | **思维导图视图（Markmap）** | 脑暴可视化 | P1 | **🟢 P2** | 无 |
| R19 | **知识时间线** | 脑暴独特创新 | P2 | **🟢 P2** | 无 |
| R20 | **健康仪表盘** | 脑暴独特创新 | — | **🟢 P2** | 无 |
| R21 | **本地小模型 Fallback（Ollama）** | 竞争#12 | P2 | **🔵 P3** | 无 |
| R22 | **多模态摄入（图片/视频/音频）** | 竞争#8 | P2 | **🔵 P3** | 无 |
| R23 | **Audio/Video Overview 生成** | 竞争#9 | P2 | **🔵 P3** | 多模态 |
| R24 | **协同编辑（Y.js + CRDT）** | 脑暴协同 | P2 | **🔵 P3** | 编辑器 |
| R25 | **Tauri 桌面 App** | 脑暴部署 | P2 | **🔵 P3** | 无 |

### 2.2 优先级变更说明

**升级到 P0**：
- **R4 前端实时同步**：原竞争分析列为 P0，但路线图未提及。鉴于 2026 wave 竞品均有后台自动化（`llm-wiki` 的文件 watcher、`MeMex` 的自动衰减、`casper` 的 pipeline），前端若不能感知后台变更，用户体验将显著落后。

**降级到 P1**：
- **R5 LLM 成本优化**：虽然重要，但在当前阶段（<100 页面）API 成本不是瓶颈。等用户量/页面数增长后再投入。
- **R8 自动化工作流**：需要 MCP Server 先完成，因此不能真正 P0。

**降级到 P2**：
- **R16 Telegram Bot**：脑暴列为 P0 因为"1 周工作量"，但相对于 MCP Server 和搜索升级，其战略价值较低。可作为社区贡献或后续迭代。
- **R15 测试套件**：零测试是长期风险，但短期内功能交付优先。

---

## 三、依赖关系图

```
Layer 0: 基础设施（无依赖）
├── R1 MCP Server
├── R2 混合搜索
├── R6 Docker Compose
└── R7 网页剪藏

Layer 1: 依赖 Layer 0
├── R3 Watch 自动 Ingest ──→ 依赖 R6 Docker（推荐）
├── R4 前端实时同步 ──→ 依赖 R3 Watch（可选，也可独立 polling）
├── R8 自动化工作流 ──→ 依赖 R1 MCP
└── R12 前端编辑器 ──→ 独立，但与 R1 MCP write 配合更好

Layer 2: 依赖 Layer 1
├── R10 Agent Memory ──→ 依赖 R1 MCP
├── R11 Context Packs ──→ 依赖 R10 Agent Memory
└── R13 图编辑 ──→ 独立，但与 R4 实时同步配合更好

Layer 3: 体验增强（依赖前两层）
├── R9 导出/分享
├── R14 PWA
├── R16 Telegram Bot ──→ 依赖 API Server
├── R18 思维导图
├── R19 知识时间线
└── R20 健康仪表盘

Layer 4: 战略探索（长期）
├── R21 本地模型 Fallback
├── R22 多模态摄入
├── R23 Audio/Video Overview ──→ 依赖 R22
├── R24 协同编辑 ──→ 依赖 R12 编辑器
└── R25 Tauri 桌面 App
```

---

## 四、分阶段实施路线图

### Phase 0：快速获胜（第 1 周）

> 目标：在主要开发工作开始前，用最小投入获得显著用户体验改善

| 需求 | 工作量 | 价值 | 实施要点 |
|------|--------|------|---------|
| R6 Docker Compose | 3 天 | ⭐⭐⭐⭐ | `docker-compose.yml` 一键启动 API + Viewer |
| R7 网页剪藏（Jina Reader） | 3 天 | ⭐⭐⭐⭐ | `POST /api/webhook/clip` 接收 URL → Jina Reader → `raw/` → 触发 ingest |
| R14 PWA 离线浏览 | 3 天 | ⭐⭐⭐ | `vite-plugin-pwa` 配置，Service Worker 已存在可复用 |
| R20 健康仪表盘（最小版） | 3 天 | ⭐⭐⭐⭐ | 新增 `/dashboard` 路由，展示页面数、链接密度、最近活动 |

**Phase 0 总工作量**：~1.5 人周（可并行）
**交付物**：Docker Compose、URL 剪藏、PWA、基础仪表盘

---

### Phase 1：核心竞争力修复（第 2–4 周）

> 目标：消除与 2026 wave 竞品的最关键差距

#### Week 2–3: MCP Server + Watch 模式

**R1 MCP Server（核心）**
```
tools/mcp_server.py          # FastMCP SDK
├── wiki_search(query, type_filter?)  # 搜索 wiki 页面
├── wiki_read(path, section?)         # 读取页面（支持分段）
├── wiki_write(path, content)         # 创建/更新页面
├── wiki_append(path, content)        # 追加内容
├── wiki_delete(path)                 # 归档页面
├── wiki_list(type?)                  # 列出页面
├── wiki_ingest(file_path)            # 摄入文件
├── wiki_lint()                       # 运行质量检查
├── wiki_health()                     # 健康状态
└── wiki_graph_query(node, depth?)    # 图谱邻居查询
```

参考实现：
- `llm-wiki` 的 21 工具设计（最完整）
- `MeMex` 的 `wiki_search` / `wiki_read` / `wiki_write` / `wiki_ingest`
- `casper` 的 `search_entities` / `traverse_graph` / `ask_graph`

**R3 Watch 自动 Ingest**
```
tools/watcher.py
├── 监控 raw/ 目录（watchdog）
├── 新文件 → markitdown 转换 → ingest.py
├── 文件修改 → SHA256 对比 → 变化则 refresh
├── 文件删除 → 标记 archived（不真正删除）
└── 防抖 5 秒
```

#### Week 3–4: 混合搜索 + 实时同步

**R2 混合搜索**
```python
# tools/search_engine.py — 最小可行实现
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
        # 去除 YAML frontmatter 后索引
        clean = strip_frontmatter(content)
        self.conn.execute("""
            INSERT OR REPLACE INTO wiki_pages(path, title, content, type, tags)
            VALUES(?,?,?,?,?)
        """, (str(path), title, clean, type, " ".join(tags)))
        self.conn.commit()
    
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

前端搜索逻辑升级：
```typescript
// 先走 FTS5，再用 Fuse.js 对 Top-K 精排
async function searchWiki(query: string): Promise<SearchResult[]> {
  const ftsResults = await apiSearchFts(query, 50);  // 宽召回
  const fuse = new Fuse(ftsResults, fuseOptions);
  return fuse.search(query).slice(0, 20);  // 精排
}
```

**R4 前端实时同步（最小可行方案）**

方案 A（推荐）：Polling + ETag
```typescript
// 每 30 秒轮询一次 index.md 的 ETag
const pollInterval = setInterval(async () => {
  const newEtag = await fetchIndexEtag();
  if (newEtag !== lastEtag) {
    invalidateCache();
    refreshWikiData();
    lastEtag = newEtag;
  }
}, 30000);
```

方案 B（完整方案）：WebSocket / SSE
```python
# api_server.py 新增
from fastapi import WebSocket

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    watcher.subscribe(lambda event: websocket.send_json(event))
```

**Phase 1 交付物**：MCP Server（stdio + 可选 SSE）、Watch 模式、FTS5 搜索、前端实时刷新

---

### Phase 2：Agent 增强层（第 5–7 周）

> 目标：从"Wiki 工具"进化为"Agent 记忆层"

#### R10 Agent Memory Ledger

```
wiki/
└── memory/
    ├── sessions/
    │   ├── 2026-05-04-001.md   # 单次会话记录
    │   └── 2026-05-04-002.md
    ├── decisions.md             # 跨会话决策日志
    └── context-packs/
        ├── pack-auth-refactor.md
        └── pack-api-design.md
```

```python
# tools/memory.py
class AgentMemory:
    def start(self, goal: str, target: str = None) -> str:
        """开始新任务，创建记忆文件，返回 session_id"""
    
    def update(self, session_id: str, notes: str, 
               decisions: list = None, changed_paths: list = None):
        """更新任务进度"""
    
    def finish(self, session_id: str, summary: str):
        """完成任务，写入摘要，更新 decisions.md"""
    
    def resume(self, session_id: str) -> dict:
        """恢复之前的任务上下文"""
```

#### R11 Context Packs

```python
# tools/context.py
class ContextPackBuilder:
    def build(self, goal: str, target: str = None, budget: int = 8000) -> str:
        """构建 token-bounded 上下文包
        
        1. 图谱遍历：从 target 出发找到相关节点（2-hop）
        2. 混合搜索：用 goal 做 FTS5 + 语义搜索补充
        3. 按新鲜度 + 相关度排序
        4. 截断到 budget tokens
        5. 添加引用来源
        """
```

#### R8 自动化工作流

```python
# api_server.py 新增 webhook 端点
@app.post("/api/webhook/ingest")
async def webhook_ingest(payload: IngestPayload):
    """n8n / GitHub Actions / 浏览器扩展 通用 webhook"""
    
@app.post("/api/webhook/github")
async def webhook_github(request: Request):
    """GitHub push 时自动 ingest raw/ 变更"""
```

**Phase 2 交付物**：Agent Memory 系统、Context Packs、Webhook API、n8n 节点示例

---

### Phase 3：体验深化（第 8–10 周）

> 目标：巩固前端差异化优势

| 需求 | 工作量 | 说明 |
|------|--------|------|
| R12 前端 Markdown 编辑器 | 1 周 | ByteMD / Milkdown 集成，保存时触发 health.py |
| R13 图可视化编辑 | 1.5 周 | vis-network 右键菜单 + 拖拽连线 + 边标签编辑 |
| R9 导出/分享 | 1 周 | SVG 卡片（html2canvas）、单页 PDF（paged.js）、HTML 快照 |
| R18 思维导图 | 3 天 | Markmap.js 集成，`/mindmap/:slug` 路由 |
| R19 知识时间线 | 3 天 | vis-timeline 渲染 `log.md` |

**Phase 3 交付物**：编辑器、图编辑、导出套件、思维导图、时间线

---

### Phase 4：战略探索（第 11 周起，按需）

| 需求 | 触发条件 | 预期工作量 |
|------|---------|-----------|
| R21 本地模型 Fallback | API 成本 > $50/月 或用户反馈离线需求 | 2 周 |
| R22 多模态摄入 | 有 3+ 用户请求处理图片/PDF 中的图 | 3 周 |
| R23 Audio/Video Overview | 多模态完成后 + 有播客/视频场景需求 | 3 周 |
| R24 协同编辑 | 有团队使用需求 | 4 周 |
| R25 Tauri 桌面 App | 有非技术用户需要一键安装 | 2 周 |

---

## 五、快速获胜清单（Quick Wins）

以下项目可在 **≤3 天** 内独立完成，ROI 高，建议穿插在各 Phase 之间：

| # | 项目 | 工作量 | 价值 | 实施要点 |
|---|------|--------|------|---------|
| QW1 | Docker Compose | 2 天 | ⭐⭐⭐⭐ | `docker-compose.yml` + `Dockerfile` |
| QW2 | PWA 离线浏览 | 2 天 | ⭐⭐⭐ | `vite-plugin-pwa` + manifest |
| QW3 | Jina Reader URL 摄入 | 1 天 | ⭐⭐⭐⭐ | `POST /api/webhook/clip` 单端点 |
| QW4 | 前端 ETag 轮询 | 1 天 | ⭐⭐⭐⭐ | `setInterval` + `If-None-Match` |
| QW5 | 健康仪表盘（最小版） | 2 天 | ⭐⭐⭐⭐ | 读取 `wiki/` 统计，展示在 `/dashboard` |
| QW6 | GitHub Action 模板 | 1 天 | ⭐⭐⭐ | `.github/workflows/auto-ingest.yml` |
| QW7 | 思维导图视图 | 2 天 | ⭐⭐⭐ | Markmap.js CDN + wiki 页面递归展开 |
| QW8 | SQLite FTS5 搜索后端 | 2 天 | ⭐⭐⭐⭐ | `tools/search_engine.py` 最小实现 |

**建议**：每完成一个主要 Phase，插入 1–2 个 Quick Win，保持交付节奏感和用户反馈循环。

---

## 六、资源估算与团队配置

### 单人全职（推荐当前阶段）

```
月 1: Phase 0 (1 周) + Phase 1 (3 周)
月 2: Phase 2 (3 周) + Phase 3 前半 (1 周)
月 3: Phase 3 后半 (2 周) + 文档/社区 (2 周)
```

### 两人协作（理想）

| 角色 | 负责 |
|------|------|
| 后端工程师 | MCP Server、Watch、搜索、Agent Memory、Webhook |
| 前端工程师 | 实时同步、编辑器、图编辑、仪表盘、导出、PWA |

并行后总时间可压缩至 **6–8 周** 完成前三个 Phase。

---

## 七、成功指标（KPI）

| 指标 | 基准 | 3 个月目标 | 6 个月目标 |
|------|------|-----------|-----------|
| MCP 工具数 | 0 | 9 | 15+ |
| 搜索方式 | Fuse.js | FTS5 + Fuse.js | 混合（FTS5 + 语义 + Fuse） |
| 自动化覆盖 | 0% | Watch + Webhook | 后台 worker |
| 前端实时感知 | ❌ | ✅ Polling | ✅ WebSocket |
| 测试覆盖 | 0% | 后端 API 测试 | 前端组件测试 |
| 部署方式 | 手动 | Docker Compose | 可选 Coolify/Tauri |

---

## 八、风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| MCP Server 设计过复杂 | 中 | 延期 2+ 周 | 从 5 工具 MVP 开始，逐步扩展 |
| FTS5 性能不如预期 | 低 | 搜索体验差 | 预留 tantivy 升级路径 |
| 竞品 MeMex 快速迭代 | 高 | 功能差距扩大 | 聚焦前端 UI + 中文差异化 |
| LLM API 成本失控 | 中 | 用户流失 | 实现 `cloud_hourly_limit`（参考 llm-wiki） |
| Docker 增加使用门槛 | 低 | 违背零基础设施哲学 | Docker 为可选，保留手动启动 |

---

## 九、参考文档

- `docs/competitive-analysis-2025.md` — 原始竞争分析与 12 条优化建议
- `docs/competitor-analysis-and-roadmap.md` — 110+ 项目竞品调研与 4 阶段路线图
- `docs/cross-domain-integration-brainstorm.md` — 8 维度整合思维与 3 大颠覆方向
- `docs/competitive-landscape-2026-update.md` — 2026-04 wave 新进入者深度分析

---

> **核心结论：整合后的路线图将 25 项需求压缩为 4 个 Phase + 8 个 Quick Win，总周期约 10 周（单人）或 6–8 周（双人）。P0 三项（MCP Server、混合搜索、实时同步）的紧迫性因 2026-04 wave 竞争而进一步升级，应在 Phase 1 内全部完成。**
