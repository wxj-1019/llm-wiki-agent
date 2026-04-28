# Wiki-Viewer 侧边栏页面内容补全方案

> **目标**：消除侧边栏各页面在"空数据""首屏冷启动""部分模块条件不满足"三种场景下的内容空洞，提升首屏信息密度和用户引导体验。
>
> **范围**：`HomePage`、`BrowsePage`、`GraphPage`、`LogPage`、`PageDetailPage`（Sidebar 导航直接或间接触达的 5 个核心页面）

---

## 一、问题诊断

### 1.1 空状态（Empty State）薄弱

| 页面 | 触发条件 | 当前表现 | 问题 |
|---|---|---|---|
| **HomePage** | `nodes.length === 0`（Wiki 刚创建，未 ingest 任何文档） | 一个居中 warm-card：📖 + 标题 + 描述 + 命令行代码块 | 只有单一行动点（命令行），对非技术用户不友好；缺少视觉层次和步骤引导 |
| **BrowsePage** | `filtered.length === 0`（搜索/筛选无结果，或 Wiki 无数据） | 🔍 + "No pages found" + "Try a different search term" | 无差异化空状态："Wiki 无数据"和"筛选无结果"用同一套文案，缺少情境化引导 |
| **GraphPage** | `graphData` 为 `null` 或 `nodes.length === 0` | 仅显示 `Loader2` 转圈 + "Loading graph..." | **无错误状态**、**无空状态**；若 API 失败或返回空数据，用户只能看到无限 loading 或空白画布 |
| **LogPage** | `entries.length === 0`（无操作日志） | 📋 + "No logs yet" + 描述 | 可接受，但缺少"如何产生第一条日志"的引导 |

### 1.2 条件渲染模块直接消失（Silent Removal）

| 页面 | 模块 | 消失条件 | 当前表现 | 问题 |
|---|---|---|---|---|
| **HomePage** | Continue Reading | `recentNodes.length === 0`（用户从未打开过任何页面） | 整块 DOM 不渲染 | 新用户看不到此模块，不知道自己"该读什么" |
| **HomePage** | Random Discovery | `nodes.length === 0` | 整块 DOM 不渲染 | 可接受（Wiki 无数据时合理） |
| **HomePage** | Knowledge Graph Mini | `!graphData` | 整块 DOM 不渲染 | 数据加载失败时用户完全看不到图谱相关的任何信息 |
| **HomePage** | Favorites | 永远消失 | **从未实现** | `wikiStore` 已存储 `favorites`，但首页没有展示入口 |
| **PageDetailPage** | Backlinks | `backlinks.length === 0` | 整块 DOM 不渲染 | 用户不知道"此页面暂无反向链接"，信息缺失 |

### 1.3 已存储但未展示的数据

| 数据 | 存储位置 | 当前使用 | 可补全场景 |
|---|---|---|---|
| `favorites` | `wikiStore` + `localStorage` | `PageDetailPage` 的 ❤️ 收藏按钮 | **HomePage 新增 Favorites 模块**：展示最近收藏的页面，点击可跳转 |
| `readingProgress` | `wikiStore` + `localStorage` | 仅存储，未读取 | **PageDetailPage 阅读进度条**：记录用户滚动位置，返回时恢复；**HomePage 展示"继续阅读"时附带进度百分比** |

### 1.4 内容展示深度不足

| 页面 | 当前展示 | 缺失内容 | 影响 |
|---|---|---|---|
| **BrowsePage** 卡片 | 图标、类型标签、标题、preview | `tags`（后端已返回）、创建日期、`backlinks_count`、收藏状态 ❤️ | 信息密度低，用户无法快速判断卡片价值 |
| **GraphPage** 节点面板 | label、type、preview、connections count | 直达链接（"Open page"按钮）、关联类型分布、所属 community | 面板是信息终点，用户需要额外点击才能进入详情 |
| **LogPage** 操作标签 | 英文小写 `ingest` / `query` / `lint` | i18n 翻译 | 中文用户看到英文操作名，体验断裂 |

---

## 二、补全方案（按页面）

### 2.1 HomePage 首页

#### A. 空状态升级：多步骤引导卡片（`nodes.length === 0`）

将当前的单一空状态卡片拆分为**三步骤视觉引导**：

```
┌─────────────────────────────────────────┐
│  📖  Welcome to LLM Wiki                 │
│     Your knowledge base is waiting...    │
│                                          │
│  Step 1        Step 2        Step 3      │
│  ┌────┐       ┌────┐       ┌────┐       │
│  │ 📝 │  →   │ ⚙️  │  →   │ 👁️ │       │
│  │Drop│       │Run │       │Explore    │
│  │file│       │cmd │       │wiki       │
│  └────┘       └────┘       └────┘       │
│  放入文档      运行命令      浏览知识     │
│                                          │
│  [ 📋 Copy Command ]                     │
│     python tools/ingest.py ...           │
└─────────────────────────────────────────┘
```

**实现要点**：
- 使用横向三列 grid，每列一个步骤图标 + 标题 + 描述
- 步骤之间用箭头连接（`ArrowRight` 图标）
- "Copy Command" 按钮点击后复制命令到剪贴板，显示 Toast "Copied!"
- 增加一个"查看示例 Wiki"的次要按钮（链接到 GitHub README 或在线 demo）

#### B. 新增 Favorites 模块（`favorites.length > 0`）

在 Stats 下方、Continue Reading 上方插入收藏夹模块：

```
┌─────────────────────────────────────────┐
│ ❤️ Favorites                    [Edit]  │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │Page A   │ │Page B   │ │Page C   │    │
│ │❤️ · src │ │❤️ · ent │ │❤️ · con │    │
│ └─────────┘ └─────────┘ └─────────┘    │
└─────────────────────────────────────────┘
```

**实现要点**：
- 横向滚动卡片列表（类似 Continue Reading 的网格布局）
- 每个卡片带 ❤️ 图标（实心红色）和类型标签
- 若 `favorites.length === 0`，显示轻量提示："Star pages to see them here" + 箭头指向 Browse

#### C. Continue Reading 空状态（`recentNodes.length === 0 && nodes.length > 0`）

当 Wiki 有数据但用户还没读过任何页面时，不隐藏模块，而是显示引导：

```
┌─────────────────────────────────────────┐
│ 🕐 Continue Reading                      │
│                                          │
│  "You haven't read any pages yet."       │
│  [ 🎲 Random Pick ]  [ 📚 Browse All ]   │
│                                          │
│  (随机推荐一个节点卡片)                   │
└─────────────────────────────────────────┘
```

**实现要点**：
- 文案区分 "无数据" 和 "有数据但未阅读" 两种情境
- 提供 "Random Pick" 按钮，直接跳转到一个随机节点
- 提供一个推荐卡片（可复用 `PageCard`）

#### D. Knowledge Graph Mini 错误/空状态（`!graphData`）

当图谱数据加载失败时，不隐藏模块，显示降级信息：

```
┌─────────────────────────────────────────┐
│ 🕸️ Knowledge Graph                       │
│                                          │
│  "Could not load graph data."            │
│  "Make sure the API server is running."  │
│  [ 🔄 Retry ]                            │
└─────────────────────────────────────────┘
```

**实现要点**：
- 复用 `wikiStore.error` 状态判断加载失败
- 提供 Retry 按钮触发 `initialize()`
- 若 `loading` 为 true 且 `graphData` 为 null，显示骨架屏（shimmer）而非完全空白

---

### 2.2 BrowsePage 浏览库

#### A. 差异化空状态

区分两种空状态：

**情境 1：Wiki 无数据（`nodes.length === 0`）**
```
🔍 No pages found
This wiki is empty. Start by ingesting your first source document.
[ 📖 View Getting Started Guide ]
```

**情境 2：筛选/搜索无结果（`nodes.length > 0 && filtered.length === 0`）**
```
🔍 No pages match your filters
Try clearing filters or searching with different keywords.
[ ❌ Clear Filters ]
```

**实现要点**：
- 根据 `nodes.length` 判断情境，渲染不同文案和 CTA
- "Clear Filters" 按钮重置 `filterType` 为 `all` 并清空 `query`

#### B. 卡片信息增强

在现有卡片基础上增加底部 meta 行：

```
┌─────────────────────────────────────────┐
│ [🔵]                        Source      │
│ Title of the Page                       │
│ Preview text goes here and wraps...     │
│                                         │
│ #tag1 #tag2              ❤️ · 3 links   │
└─────────────────────────────────────────┘
```

**实现要点**：
- 新增 `tags` 展示（最多 2 个，超出显示 `+N`）
- 新增收藏状态（若该节点在 `favorites` 中，显示实心 ❤️）
- 新增反向链接数量（通过 `getBacklinks(node.id).length`）
- 新增 `last_updated` 日期（从 `node.markdown` 解析 frontmatter）

#### C. 排序控件

在 Tabs 右侧增加排序下拉菜单：

```
[All] [Source] [Entity] [Concept] [Synthesis]    [Sort: Recently Updated ▼]
```

**排序选项**：
- Recently Updated（默认，按 `last_updated` 降序）
- Name A-Z
- Most Connected（按 backlinks 数量降序）
- Recently Added（按 frontmatter `date` 降序）

---

### 2.3 GraphPage 知识图谱

#### A. 加载/错误/空状态三重处理

当前只有 `loading` 状态，需补全：

**Loading**：保留现有 `Loader2` + "Loading graph..."，但增加**进度感**（如 "Building 120 nodes..." 的模拟进度文字，或骨架屏）。

**Error（`!loading && !graphData`）**：
```
┌─────────────────────────────────────────┐
│  ⚠️ Could not load graph                 │
│     Make sure the API server is running  │
│     on port 8000.                        │
│  [ 🔄 Retry ]                            │
└─────────────────────────────────────────┘
```

**Empty（`!loading && graphData && nodes.length === 0`）**：
```
┌─────────────────────────────────────────┐
│  🕸️ Empty Graph                          │
│     No nodes to display. Ingest sources  │
│     to build your knowledge graph.       │
│  [ 📚 Browse Pages ]                     │
└─────────────────────────────────────────┘
```

#### B. 节点详情面板增强

当前面板信息太少，增加行动按钮和元信息：

```
┌─────────────────────────────────────────┐
│ Title of Node                    [✕]    │
│ Source                                   │
│                                          │
│ Preview text...                          │
│                                          │
│ 🔗 5 connections                         │
│     3 from sources                       │
│     2 from entities                      │
│                                          │
│ [ 📖 Open Page ]  [ ❤️ Star ]            │
└─────────────────────────────────────────┘
```

**实现要点**：
- "Open Page" 按钮直接跳转到 `PageDetailPage`（复用 `getPagePath` 逻辑）
- "Star" 按钮调用 `toggleFavorite`，实时反馈
- 连接数按来源类型分组展示（`EXTRACTED` vs `INFERRED` vs `AMBIGUOUS`）

#### C. 图谱统计浮层

在画布左上角增加一个迷你统计面板（可折叠）：

```
┌─────────────┐
│ ▼ Graph Stats    │
│ Nodes: 120       │
│ Edges: 340       │
│ Communities: 5   │
│ Density: 0.04    │
└─────────────┘
```

---

### 2.4 LogPage 操作日志

#### A. 操作类型 i18n 翻译

将英文操作名翻译为中文：

| 操作 | 英文 | 中文翻译 key |
|---|---|---|
| ingest | ingest | `log.op.ingest` → "摄入" |
| query | query | `log.op.query` → "查询" |
| lint | lint | `log.op.lint` → "检查" |
| health | health | `log.op.health` → "健康检查" |
| graph | graph | `log.op.graph` → "构建图谱" |
| heal | heal | `log.op.heal` → "修复" |
| report | report | `log.op.report` → "报告" |

**实现要点**：
- 新增 `opTranslationKeys` 映射表
- 渲染时用 `t(`log.op.${entry.operation}`)` 或 fallback 回英文

#### B. 空状态增强

当前空状态：
```
📋 No logs yet
Operations will appear here once you ingest sources
```

增强版：
```
📋 No logs yet
Operations will appear here once you ingest sources.

Tip: Run the command below to add your first source.
[ 📋 Copy ]  python tools/ingest.py raw/your-document.md
```

#### C. 日志统计摘要

在标题下方增加一行统计 pills：

```
Operation Log
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Ingest: 12] [Query: 5] [Lint: 2] [Health: 8]  Total: 27
```

**实现要点**：
- 按 `operation` 分组计数
- 每个 pill 带对应颜色（复用 `opColors`）
- 点击 pill 可筛选日志（可选）

---

### 2.5 PageDetailPage 详情页

#### A. Backlinks 空状态（`backlinks.length === 0`）

当前 backlinks 为空时整块消失，补全为：

```
┌─────────────────────────────────────────┐
│ 🔗 Linked from (0 pages)                 │
│                                          │
│ "No other pages link here yet."          │
│ "Links are created automatically when    │
│  other pages mention this page."         │
└─────────────────────────────────────────┘
```

#### B. 阅读进度条

在页面顶部（breadcrumb 下方）增加一个细进度条：

```
Browse / Source / Page Title
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 45%
```

**实现要点**：
- 监听滚动事件，计算 `scrollTop / (scrollHeight - clientHeight)`
- 存储到 `readingProgress[node.id]`
- 进度条颜色使用 `apple-blue`，高度 2px
- 进入页面时恢复滚动位置

#### C. 收藏状态增强

将当前的 ❤️ 按钮从 header 移至更醒目的位置，或在 header 旁边增加 "Add to Favorites" 文字提示（仅在未收藏时显示）。

---

## 三、实施优先级

### P0 — 体验阻断（必须修复）

1. **GraphPage 错误/空状态** — 当前 API 失败时用户只能看到 loading 或空白，完全无法继续
2. **BrowsePage 差异化空状态** — 区分"Wiki 空"和"筛选无结果"，避免用户困惑
3. **HomePage 空状态升级** — 三步骤引导降低新用户上手门槛

### P1 — 信息补全（显著提升）

4. **HomePage Favorites 模块** — 已存储的数据直接复用，零后端改动
5. **BrowsePage 卡片增强** — tags、收藏状态、backlinks 数量
6. **GraphPage 节点面板增强** — Open Page 按钮、连接类型分布
7. **PageDetailPage Backlinks 空状态** — 消除信息缺失感

### P2 — 体验打磨（锦上添花）

8. **LogPage 操作类型 i18n** — 中文用户友好
9. **LogPage 统计摘要** — 信息密度提升
10. **PageDetailPage 阅读进度** — 需要滚动监听，复杂度略高
11. **BrowsePage 排序控件** — 前端排序，无后端依赖
12. **GraphPage 统计浮层** — 可视化增强

---

## 四、新增翻译 Key 清单

### HomePage
```json
{
  "home.empty.step1.title": "Drop Documents",
  "home.empty.step1.desc": "Put Markdown files into the raw/ directory",
  "home.empty.step2.title": "Run Ingest",
  "home.empty.step2.desc": "Execute the ingest command in terminal",
  "home.empty.step3.title": "Explore",
  "home.empty.step3.desc": "Browse your auto-generated knowledge base",
  "home.empty.copyCommand": "Copy Command",
  "home.empty.copied": "Copied!",
  "home.empty.viewDemo": "View Demo",
  "home.favorites.title": "Favorites",
  "home.favorites.empty": "Star pages to see them here",
  "home.continueReading.empty": "You haven't read any pages yet.",
  "home.continueReading.randomPick": "Random Pick",
  "home.graph.error": "Could not load graph data.",
  "home.graph.retry": "Retry"
}
```

### BrowsePage
```json
{
  "browse.empty.noData.title": "This wiki is empty",
  "browse.empty.noData.description": "Start by ingesting your first source document.",
  "browse.empty.noData.cta": "View Getting Started Guide",
  "browse.empty.noResults.clearFilters": "Clear Filters",
  "browse.sort.label": "Sort",
  "browse.sort.updated": "Recently Updated",
  "browse.sort.name": "Name A-Z",
  "browse.sort.connected": "Most Connected",
  "browse.sort.added": "Recently Added",
  "browse.card.links_one": "1 link",
  "browse.card.links_other": "{{count}} links"
}
```

### GraphPage
```json
{
  "graph.error.title": "Could not load graph",
  "graph.error.description": "Make sure the API server is running on port 8000.",
  "graph.error.retry": "Retry",
  "graph.empty.title": "Empty Graph",
  "graph.empty.description": "No nodes to display. Ingest sources to build your knowledge graph.",
  "graph.empty.browse": "Browse Pages",
  "graph.panel.openPage": "Open Page",
  "graph.panel.star": "Star",
  "graph.panel.unstar": "Unstar",
  "graph.stats.title": "Graph Stats",
  "graph.stats.nodes": "Nodes",
  "graph.stats.edges": "Edges",
  "graph.stats.communities": "Communities",
  "graph.stats.density": "Density",
  "graph.edgeType.extracted": "Extracted",
  "graph.edgeType.inferred": "Inferred",
  "graph.edgeType.ambiguous": "Ambiguous"
}
```

### LogPage
```json
{
  "log.op.ingest": "Ingest",
  "log.op.query": "Query",
  "log.op.lint": "Lint",
  "log.op.health": "Health",
  "log.op.graph": "Graph",
  "log.op.heal": "Heal",
  "log.op.report": "Report",
  "log.empty.cta": "Run the command below to add your first source.",
  "log.empty.copy": "Copy",
  "log.stats.total": "Total: {{count}}"
}
```

### PageDetailPage
```json
{
  "detail.backlinks.zero": "No other pages link here yet.",
  "detail.backlinks.hint": "Links are created automatically when other pages mention this page.",
  "detail.favorite.add": "Add to Favorites",
  "detail.favorite.remove": "Remove from Favorites"
}
```

---

## 五、组件设计建议

### 5.1 可复用的新组件

| 组件 | 位置 | 用途 | 复用点 |
|---|---|---|---|
| `EmptyState` | `src/components/ui/EmptyState.tsx` | 统一空状态模板 | Home、Browse、Graph、Log、Detail |
| `StepGuide` | `src/components/ui/StepGuide.tsx` | 横向步骤引导 | Home 空状态 |
| `FavoriteButton` | `src/components/ui/FavoriteButton.tsx` | 带文字提示的收藏按钮 | Detail header、Graph panel、Browse card |
| `PageMetaBar` | `src/components/ui/PageMetaBar.tsx` | 卡片底部 tags + 收藏 + links | Browse card |
| `StatPills` | `src/components/ui/StatPills.tsx` | 横向统计 pill 列表 | Log 统计、Graph 统计 |

### 5.2 状态管理调整（wikiStore）

无需新增 store 字段，但建议暴露：

```typescript
// 新增 selector-like helper（纯函数，不修改 store）
export function useNodeBacklinks(nodeId: string): GraphNode[] {
  const getBacklinks = useWikiStore((s) => s.getBacklinks);
  return useMemo(() => getBacklinks(nodeId), [getBacklinks, nodeId]);
}
```

阅读进度已存储为 `readingProgress: Record<string, number>`，只需在 `PageDetailPage` 增加读写逻辑：

```typescript
useEffect(() => {
  // 恢复滚动
  const saved = readingProgress[node.id];
  if (saved) window.scrollTo(0, saved * document.body.scrollHeight);
  
  const handleScroll = () => {
    const progress = window.scrollY / (document.body.scrollHeight - window.innerHeight);
    setReadingProgress(node.id, Math.min(1, Math.max(0, progress)));
  };
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, [node.id]);
```

---

## 六、验收标准

### 场景 1：全新 Wiki（无数据）
- [ ] 打开 Home，看到三步骤引导卡片，而非单一文本块
- [ ] 打开 Browse，看到 "Wiki is empty" 空状态 + 引导 CTA
- [ ] 打开 Graph，看到 "Empty Graph" 空状态 + "Browse Pages" 按钮
- [ ] 打开 Log，看到增强空状态 + 命令复制按钮
- [ ] Stats 区域显示 0，但不隐藏

### 场景 2：有数据但未阅读任何页面
- [ ] Home 显示 Continue Reading 模块，内容为随机推荐 + "Random Pick" 按钮
- [ ] Browse 卡片展示 tags、收藏状态、链接数

### 场景 3：正常浏览
- [ ] Graph 点击节点，面板显示 "Open Page" 和 "Star" 按钮
- [ ] Log 操作标签显示中文（中文环境下）
- [ ] PageDetail 无 backlinks 时显示提示文案
- [ ] 切换语言后，所有新增文案实时更新

---

## 七、工作量估算

| 阶段 | 内容 | 预估 |
|---|---|---|
| **阶段 1** | P0 修复（Graph 错误/空状态、Browse 差异化空状态、Home 空状态升级） | 2-3h |
| **阶段 2** | P1 补全（Favorites 模块、卡片增强、节点面板、Backlinks 空状态） | 3-4h |
| **阶段 3** | P2 打磨（Log i18n、统计摘要、阅读进度、排序控件、统计浮层） | 3-4h |
| **翻译** | 新增 ~40 个 key 的中英双语 | 1h |
| **测试** | 三种场景验收 + 语言切换验证 | 1h |
| **合计** | | **10-13h** |

---

*文档生成时间：2026-04-27*
*关联代码版本：wiki-viewer (React 18 + Vite 5 + i18n 已接入)*
