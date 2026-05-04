# LLM Wiki Agent — 内容优化与拓展优先级实施计划

> **来源**: 综合 `docs/competitive-analysis-2025.md`、`docs/competitive-landscape-2026-update.md`、`docs/competitor-analysis-and-roadmap.md`、`docs/cross-domain-integration-brainstorm.md`、`docs/strategic-roadmap-consolidated.md`、`docs/divergent-thinking-*.md` 及 `docs/plan/*`
> **日期**: 2026-05-04
> **周期**: 10 周（单人）/ 6–8 周（双人并行）

---

## 一、核心结论

2026 年 4–5 月的 Karpathy Wiki 克隆潮将 **MCP Server** 和 **混合搜索** 从"差异化优势"变成了**准入门槛**。本项目在 React 前端、中文 i18n、零基础设施三个维度仍保持显著优势，但以下三项必须立即补齐：

| 缺口 | 竞品覆盖率 | 威胁等级 |
|------|-----------|---------|
| **MCP Server** | 100% 直接竞品已有 | 🔴 **极高** |
| **混合搜索** | 4/6 直接竞品已有 | 🔴 **高** |
| **后台自动化** | 3/6 直接竞品已有 | 🟡 **中** |

---

## 二、优先级总览（四层架构）

```
Layer 0: 基础设施（无依赖）
├── P0-1 MCP Server 实现
├── P0-2 混合搜索（FTS5 + 语义嵌入）
├── P0-3 Watch 自动 Ingest + 前端实时同步
└── P1-1 Docker Compose 一键部署

Layer 1: 依赖 Layer 0
├── P1-2 网页剪藏 / URL 摄入（Jina Reader）
├── P1-3 前端 Markdown 编辑器
├── P1-4 图可视化编辑（vis-network 交互增删）
└── P1-5 Agent Memory Ledger + Context Packs

Layer 2: 体验深化
├── P1-6 导出/分享功能（SVG 卡片 / PDF / HTML）
├── P2-1 Wiki-Viewer 内容补全（空状态/错误状态/信息增强）
├── P2-2 PWA 离线浏览
├── P2-3 测试套件（pytest + vitest）
└── P2-4 思维导图 / 知识时间线 / 健康仪表盘

Layer 3: 战略探索
├── P3-1 本地小模型 Fallback（Ollama）
├── P3-2 多模态摄入（图片/视频/音频）
├── P3-3 Audio/Video Overview 生成
├── P3-4 协同编辑（Y.js + CRDT）
└── P3-5 Tauri 桌面 App
```

---

## 三、Phase 0：快速获胜（第 1 周）

> 目标：在主要开发工作开始前，用最小投入获得显著用户体验改善

| # | 任务 | 工作量 | 价值 | 关键实现 |
|---|------|--------|------|---------|
| QW1 | Docker Compose 一键部署 | 2 天 | ⭐⭐⭐⭐ | `docker-compose.yml` + `Dockerfile`（API + Viewer + MCP + Watcher） |
| QW2 | PWA 离线浏览 | 2 天 | ⭐⭐⭐ | `vite-plugin-pwa` + Service Worker 缓存策略 |
| QW3 | Jina Reader URL 摄入 | 1 天 | ⭐⭐⭐⭐ | `POST /api/webhook/clip` 接收 URL → Jina Reader → `raw/` → 触发 ingest |
| QW4 | 前端 ETag 轮询（实时同步最小版） | 1 天 | ⭐⭐⭐⭐ | `setInterval` + `If-None-Match` 检测 `index.md` 变更 |
| QW5 | 健康仪表盘（最小版） | 2 天 | ⭐⭐⭐⭐ | 新增 `/dashboard` 路由，展示页面数、链接密度、最近活跃度 |
| QW6 | GitHub Action 模板 | 1 天 | ⭐⭐⭐ | `.github/workflows/auto-ingest.yml`：push 到 `raw/` 自动触发 ingest |

**Phase 0 总工作量**: ~1.5 人周（可并行）

---

## 四、Phase 1：核心竞争力修复（第 2–4 周）

> 目标：消除与 2026 wave 竞品的最关键差距

### Week 2–3: MCP Server + Watch 模式

#### P0-1 MCP Server 实现

**最小可行工具集（5 个起步，逐步扩展到 9 个）**：

```
tools/mcp_server.py          # FastMCP SDK
├── wiki_search(query, type_filter?)  → 搜索 wiki 页面
├── wiki_read(path, section?)         → 读取页面（支持分段）
├── wiki_write(path, content)         → 创建/更新页面
├── wiki_list(type?)                  → 列出页面
└── wiki_ingest(file_path)            → 摄入文件

扩展工具（Phase 2 追加）：
├── wiki_graph_query(node, depth?)    → 图谱邻居查询
├── wiki_health()                     → 健康状态
├── wiki_lint()                       → 运行质量检查
└── wiki_append(path, content)        → 追加内容
```

**参考实现**：`docs/plan/auto-generate-mcp-and-skill-from-wiki.md` 已提供完整代码模板（含 `wiki_mcp_server.py`、`wiki_index.py`、`graph_client.py`）。

**关键设计**：
- Resources：每个 wiki 页面注册为 `wiki://{type}/{slug}` Resource
- Tools：基于 `docs/plan/auto-generate-mcp-and-skill-from-wiki.md` 的 8 工具设计
- Prompts：`summarize_topic`、`compare_entities`、`trace_evolution`、`find_contradictions`

#### P0-3 Watch 自动 Ingest

```
tools/watcher.py              # watchdog 文件监控
├── 监控 raw/ 目录变化
├── 新文件 → markitdown 转换 → ingest.py
├── 文件修改 → SHA256 对比 → 变化则 refresh
├── 文件删除 → 标记 archived（不真正删除）
└── 防抖 5 秒（避免批量操作触发大量 ingest）
```

### Week 3–4: 混合搜索 + 实时同步

#### P0-2 混合搜索

**后端**：`tools/search_engine.py` — SQLite FTS5 + 可选 Ollama 嵌入

```python
class WikiSearchEngine:
    def __init__(self, db_path="state/search.db"):
        # FTS5 虚拟表：title, content, type, tags, path
        # tokenize='porter unicode61'（支持中英文）
    
    def search(self, query, limit=20):
        # 1. FTS5 宽召回（limit * 2）
        # 2. 可选：Ollama 语义召回（nomic-embed-text）
        # 3. Reciprocal Rank Fusion 融合排序
```

**前端**：先走 FTS5 API，再用 Fuse.js 对 Top-K 精排（与现有搜索 UI 无缝衔接）。

#### P0-3（续）前端实时同步

**推荐方案 A：Polling + ETag**（1 天实现，90% 价值）
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

**完整方案 B：WebSocket / SSE**（1 周实现，适合 Phase 2）

**Phase 1 交付物**：MCP Server（stdio + 可选 SSE）、Watch 模式、FTS5 搜索、前端实时刷新

---

## 五、Phase 2：Agent 增强层（第 5–7 周）

> 目标：从"Wiki 工具"进化为"Agent 记忆层"

### P1-5 Agent Memory Ledger

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
    def update(self, session_id: str, notes: str, decisions: list = None):
        """更新任务进度"""
    def finish(self, session_id: str, summary: str):
        """完成任务，写入摘要，更新 decisions.md"""
    def resume(self, session_id: str) -> dict:
        """恢复之前的任务上下文"""
```

### P1-5（续）Context Packs

```python
# tools/context.py
class ContextPackBuilder:
    def build(self, goal: str, target: str = None, budget: int = 8000) -> str:
        # 1. 图谱遍历：从 target 出发找到相关节点（2-hop）
        # 2. 混合搜索：用 goal 做 FTS5 + 语义搜索补充
        # 3. 按新鲜度 + 相关度排序
        # 4. 截断到 budget tokens
        # 5. 添加引用来源
```

### P1-2 网页剪藏（扩展）

- 浏览器扩展（Chrome/Firefox）：右键"保存到 Wiki"
- 复用现有 RSS 配置（Settings 页已有 RSS UI），增加自动定时摄入
- `trafilatura` 或 `readability-lxml` 做网页正文提取

### P1-6 自动化工作流

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

## 六、Phase 3：体验深化（第 8–10 周）

> 目标：巩固前端差异化优势 + 补齐内容空洞

### P1-3 前端 Markdown 编辑器

- 集成 `ByteMD`、`Vditor` 或 `Milkdown`
- 保存时触发 `health.py` 验证 + 自动更新 `index.md`
- 编辑权限可配置（只读/编辑/Admin）

### P1-4 图可视化编辑

- vis-network 右键菜单：添加节点/边
- 拖拽连接两个节点
- 编辑边标签和置信度
- 变更回写到 `graph.json` 和对应 Markdown 文件（双向同步）

### P1-6 导出/分享功能

- **图谱快照**：SVG/PNG 导出（html2canvas 或 vis.js 内置）
- **Wiki PDF**：完整 wiki 或选定页面导出为 PDF
- **HTML 单文件**：自包含 HTML wiki 快照
- **SVG 分享卡片**：图谱概览 + 统计数据（参考 SwarmVault）

### P2-1 Wiki-Viewer 内容补全（详见 `docs/plan/wiki-viewer-content-gap-plan.md`）

| 优先级 | 任务 | 工作量 |
|--------|------|--------|
| **P0** | GraphPage 错误/空状态三重处理 | 2h |
| **P0** | BrowsePage 差异化空状态 | 1h |
| **P0** | HomePage 空状态升级（三步骤引导） | 1h |
| **P1** | HomePage Favorites 模块 | 1h |
| **P1** | BrowsePage 卡片增强（tags/收藏/links） | 2h |
| **P1** | GraphPage 节点面板增强 | 1h |
| **P1** | PageDetailPage Backlinks 空状态 | 30min |
| **P2** | LogPage 操作类型 i18n | 30min |
| **P2** | PageDetailPage 阅读进度条 | 1h |
| **P2** | BrowsePage 排序控件 | 1h |

### P2-2 / P2-4 其他体验增强

- **PWA 离线浏览**：`vite-plugin-pwa`（已在 QW2 完成基础，此处深化）
- **思维导图**：Markmap.js 集成，`/mindmap/:slug` 路由
- **知识时间线**：vis-timeline 渲染 `log.md`
- **健康仪表盘**：雷达图（完整性/一致性/连通性/新鲜度/多样性）+ 趋势图

**Phase 3 交付物**：编辑器、图编辑、导出套件、内容补全、思维导图、时间线、仪表盘

---

## 七、Phase 4：战略探索（第 11 周起，按需）

| 需求 | 触发条件 | 预期工作量 |
|------|---------|-----------|
| P3-1 本地模型 Fallback | API 成本 > $50/月 或用户反馈离线需求 | 2 周 |
| P3-2 多模态摄入 | 有 3+ 用户请求处理图片/PDF 中的图 | 3 周 |
| P3-3 Audio/Video Overview | 多模态完成后 + 有播客/视频场景需求 | 3 周 |
| P3-4 协同编辑 | 有团队使用需求 | 4 周 |
| P3-5 Tauri 桌面 App | 有非技术用户需要一键安装 | 2 周 |

---

## 八、依赖关系与实施顺序

```
Phase 0 (Week 1)
├── QW1 Docker Compose ────────────────────────┐
├── QW2 PWA ──────────────────────────────────┤
├── QW3 URL 剪藏 ──────────────────────────────┤ 并行，无依赖
├── QW4 ETag 轮询 ─────────────────────────────┤
├── QW5 健康仪表盘 ────────────────────────────┤
└── QW6 GitHub Action ─────────────────────────┘

Phase 1 (Week 2–4)
├── P0-1 MCP Server ───────────────────────────┐
├── P0-3 Watch 自动 Ingest ────────────────────┤ Week 2–3
│   └── 依赖 QW1 Docker（推荐）
│
├── P0-2 混合搜索 ─────────────────────────────┤ Week 3–4
│   ├── 依赖 QW8 SQLite FTS5（如未在 Phase 0 做）
│   └── 可选：Ollama 嵌入
│
└── P0-3（续）前端实时同步 ─────────────────────┘
    └── 依赖 QW4 ETag（如已做则深化为 WebSocket）

Phase 2 (Week 5–7)
├── P1-5 Agent Memory ─────────────────────────┐
│   └── 依赖 P0-1 MCP
├── P1-5（续）Context Packs ───────────────────┤
│   └── 依赖 Agent Memory
├── P1-2 网页剪藏（扩展）───────────────────────┤ Week 5–7
│   └── 依赖 QW3 URL 剪藏
├── P1-6 自动化工作流 ─────────────────────────┤
│   └── 依赖 P0-1 MCP
└── P1-1 Docker（如 Phase 0 未完成）───────────┘

Phase 3 (Week 8–10)
├── P1-3 前端 Markdown 编辑器 ─────────────────┐
├── P1-4 图可视化编辑 ─────────────────────────┤
├── P1-6 导出/分享 ────────────────────────────┤ Week 8–10
├── P2-1 Wiki-Viewer 内容补全 ─────────────────┤
├── P2-2 PWA 深化 ─────────────────────────────┤
├── P2-3 测试套件 ─────────────────────────────┤
└── P2-4 思维导图/时间线/仪表盘 ────────────────┘
```

---

## 九、资源估算

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
| 前端工程师 | 实时同步、编辑器、图编辑、仪表盘、导出、PWA、内容补全 |

并行后总时间可压缩至 **6–8 周** 完成前三个 Phase。

---

## 十、成功指标（KPI）

| 指标 | 基准 | 3 个月目标 | 6 个月目标 |
|------|------|-----------|-----------|
| MCP 工具数 | 0 | 9 | 15+ |
| 搜索方式 | Fuse.js | FTS5 + Fuse.js | 混合（FTS5 + 语义 + Fuse） |
| 自动化覆盖 | 0% | Watch + Webhook | 后台 worker |
| 前端实时感知 | ❌ | ✅ Polling | ✅ WebSocket |
| 测试覆盖 | 0% | 后端 API 测试 | 前端组件测试 |
| 部署方式 | 手动 | Docker Compose | 可选 Coolify/Tauri |

---

## 十一、风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| MCP Server 设计过复杂 | 中 | 延期 2+ 周 | 从 5 工具 MVP 开始，逐步扩展 |
| FTS5 性能不如预期 | 低 | 搜索体验差 | 预留 tantivy 升级路径 |
| 竞品 MeMex 快速迭代 | 高 | 功能差距扩大 | 聚焦前端 UI + 中文差异化 |
| LLM API 成本失控 | 中 | 用户流失 | 实现 `cloud_hourly_limit`（参考 llm-wiki） |
| Docker 增加使用门槛 | 低 | 违背零基础设施哲学 | Docker 为可选，保留手动启动 |

---

## 十二、参考文档索引

| 文档 | 内容 |
|------|------|
| `docs/competitive-analysis-2025.md` | 项目现状总评与 12 条优化建议 |
| `docs/competitive-landscape-2026-update.md` | 2026-04 wave 新进入者深度分析 |
| `docs/competitor-analysis-and-roadmap.md` | 110+ 项目竞品调研与 4 阶段路线图 |
| `docs/cross-domain-integration-brainstorm.md` | 8 维度整合思维与 3 大颠覆方向 |
| `docs/strategic-roadmap-consolidated.md` | 合并三份文档的优先级路线图（25 项需求去重） |
| `docs/plan/auto-generate-mcp-and-skill-from-wiki.md` | MCP Server + Kimi Skill 自动生成方案（含完整代码） |
| `docs/plan/wiki-viewer-content-gap-plan.md` | Wiki-Viewer 内容补全方案（空状态/错误状态/信息增强） |
| `docs/plan/mcp-skill-integration-plan.md` | MCP/Skill 集成计划 |
| `docs/plan/i18n-implementation-plan.md` | i18n 实施方案 |
| `docs/plan/upload-page-optimization-plan.md` | Upload 页面优化 |

---

> **核心理念**：编译一次，查询无限。让 Wiki 成为 Agent 的持久记忆层，而不是人类的阅读器。
