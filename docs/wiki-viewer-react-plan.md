# LLM Wiki Viewer — React 自定义页面实现方案

> **项目目标：** 为 LLM Wiki Agent 构建一个独立的 React 前端应用，替代 Obsidian 成为 wiki 内容的主要浏览界面，提供页面浏览、知识图谱可视化、全文搜索等完整功能。

---

## 一、技术选型说明

| 类别 | 选型 | 理由 |
|---|---|---|
| **框架** | React 18 + TypeScript | 类型安全、生态丰富、社区活跃 |
| **构建工具** | Vite 5 | 极速 HMR、原生 TS 支持、开箱即用 |
| **路由** | React Router v6 | 声明式路由、嵌套路由、动态参数 |
| **状态管理** | Zustand | 轻量（~1KB）、无 boilerplate、支持持久化 |
| **样式方案** | Tailwind CSS 3 | 原子化 CSS、快速迭代、支持深浅色切换 |
| **UI 组件库** | Radix UI（无样式原语）+ 自定义样式 | 无障碍访问、完全可控的样式、无锁定 |
| **Markdown 渲染** | react-markdown + remark-gfm + rehype-raw | GFM 支持、可扩展插件体系 |
| **图谱可视化** | vis-network（与现有 graph.html 一致） | 数据格式零转换、已有成熟交互 |
| **代码高亮** | Prism.js（via react-syntax-highlighter） | 轻量、主题丰富 |
| **HTTP 客户端** | 原生 fetch + 自封装 hooks | 无额外依赖、项目体量不需要 axios |
| **图标** | Lucide React | 轻量、风格统一、树摇友好 |
| **测试** | Vitest + React Testing Library | 与 Vite 原生集成、专注行为测试 |
| **Lint/Format** | ESLint + Prettier | 代码质量保障 |

### 设计风格

遵循用户偏好：**Dreamy Clay** 风格（Claymorphism 45% + Soft UI 25% + Playful Motion 20% + Organic Shapes 10%）。

- 配色：蜜桃粉 `#FFB5A7` + 薰衣草紫 `#CDB4DB` + 奶油白 `#FEFAE0`
- 字体：Fredoka（标题）+ Quicksand（正文）+ Fira Code（代码）
- 交互：果冻按钮、Q 弹动画、弹性反馈
- 同时支持深浅色模式，两种模式均保持可爱温暖风格

---

## 二、数据源分析

### 2.1 已有数据文件

React 前端需要读取的数据完全由现有工具链生成，**无需修改任何后端逻辑**：

| 数据文件 | 生成方式 | 内容说明 |
|---|---|---|
| `graph/graph.json` | `python tools/build_graph.py` | 全部节点（含完整 markdown）、边、社区信息 |
| `wiki/index.md` | `python tools/ingest.py` | 结构化目录（Sources/Entities/Concepts/Syntheses） |
| `wiki/overview.md` | `python tools/ingest.py` | 跨源综合摘要 |
| `wiki/log.md` | 所有工具脚本 | 追加式操作日志 |
| `wiki/sources/*.md` | `python tools/ingest.py` | 各源文档的结构化摘要 |
| `wiki/entities/*.md` | `python tools/ingest.py` | 实体页面 |
| `wiki/concepts/*.md` | `python tools/ingest.py` | 概念页面 |
| `wiki/syntheses/*.md` | `python tools/query.py --save` | 保存的查询答案 |

### 2.2 graph.json Schema（核心数据源）

```typescript
interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  built: string; // ISO date
}

interface GraphNode {
  id: string;          // "sources/my-paper", "entities/OpenAI"
  label: string;       // 显示标题
  type: "source" | "entity" | "concept" | "synthesis" | "unknown";
  color: string;       // 十六进制颜色
  path: string;        // "wiki/sources/my-paper.md"
  markdown: string;    // 完整的 markdown 原文（含 frontmatter）
  preview: string;     // 前 220 字符预览
  group: number;       // 社区 ID（-1 表示未分组）
  value: number;       // 度数 + 1（用于节点大小）
}

interface GraphEdge {
  id: string;          // "from->to:TYPE"
  from: string;        // 源节点 ID
  to: string;          // 目标节点 ID
  type: "EXTRACTED" | "INFERRED" | "AMBIGUOUS";
  title: string;       // 关系描述
  label: string;       // 边标签
  color: string;       // 边颜色
  confidence: number;  // 0.0–1.0
}
```

### 2.3 页面 Frontmatter 格式

```yaml
---
title: "Page Title"
type: source | entity | concept | synthesis
tags: [tag1, tag2]
sources: [slug1, slug2]
last_updated: YYYY-MM-DD
---
```

---

## 三、项目初始化步骤

### 3.1 创建 React 子项目

```bash
# 在项目根目录下创建前端子项目
cd e:\A_Project\llm-wiki-agent
npm create vite@latest wiki-viewer -- --template react-ts
cd wiki-viewer
```

### 3.2 安装依赖

```bash
# 核心依赖
npm install react-router-dom zustand react-markdown remark-gfm rehype-raw
npm install vis-network react-syntax-highlighter
npm install lucide-react
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install @radix-ui/react-tabs @radix-ui/react-tooltip
npm install date-fns

# 开发依赖
npm install -D tailwindcss @tailwindcss/vite
npm install -D @types/react-syntax-highlighter
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D prettier eslint-config-prettier
```

### 3.3 配置 Vite 开发代理

```typescript
// wiki-viewer/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

---

## 四、组件结构设计

### 4.1 组件树

```
<App>
  <Layout>
    <Sidebar />              // 左侧导航栏
    <MainContent>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/sources" element={<SourceListPage />} />
        <Route path="/sources/:slug" element={<PageDetailPage />} />
        <Route path="/entities" element={<EntityListPage />} />
        <Route path="/entities/:name" element={<PageDetailPage />} />
        <Route path="/concepts" element={<ConceptListPage />} />
        <Route path="/concepts/:name" element={<PageDetailPage />} />
        <Route path="/syntheses" element={<SynthesisListPage />} />
        <Route path="/syntheses/:slug" element={<PageDetailPage />} />
        <Route path="/log" element={<LogPage />} />
        <Route path="/search" element={<SearchPage />} />
      </Routes>
    </MainContent>
  </Layout>
</App>
```

### 4.2 组件清单

| 组件 | 职责 | 复用场景 |
|---|---|---|
| `Layout` | 全局布局骨架（侧边栏 + 主内容区） | 所有页面 |
| `Sidebar` | 导航菜单、快速搜索、最近活动 | 全局 |
| `DashboardPage` | 总览仪表盘（统计数据、最近更新、健康状态） | 首页 |
| `GraphPage` | 知识图谱全屏可视化（vis-network） | 图谱浏览 |
| `SourceListPage` | 源文档列表（卡片/表格切换） | 源文档管理 |
| `EntityListPage` | 实体列表（按分类/社区筛选） | 实体浏览 |
| `ConceptListPage` | 概念列表（标签云/列表切换） | 概念浏览 |
| `SynthesisListPage` | 综合查询列表 | 查询历史 |
| `PageDetailPage` | 通用页面详情（markdown 渲染 + 元数据 + 反向链接） | 所有类型页面 |
| `LogPage` | 操作日志时间线 | 审计追踪 |
| `SearchPage` | 全文搜索结果页 | 全局搜索 |
| `MarkdownRenderer` | Markdown 渲染器（含 wikilink 解析） | PageDetail, Search |
| `WikiLink` | 可点击的 [[wikilink]] 组件（路由跳转） | MarkdownRenderer |
| `PageCard` | 页面卡片（预览 + 标签 + 类型标记） | 列表页 |
| `TagCloud` | 标签云组件 | 概念浏览 |
| `GraphControls` | 图谱控制面板（过滤、搜索、布局） | GraphPage |
| `GraphNodeDrawer` | 节点详情抽屉（点击图谱节点弹出） | GraphPage |
| `BackLinks` | 反向链接面板（谁链接到当前页） | PageDetailPage |
| `Breadcrumb` | 面包屑导航 | 页面详情 |
| `EmptyState` | 空状态提示（可爱插画 + 引导文案） | 列表页空态 |
| `SearchBar` | 全局搜索栏（带快捷键 Ctrl+K） | Sidebar, Header |
| `ThemeToggle` | 深浅色切换按钮（带动画） | Header |
| `StatusBar` | 底部状态栏（wiki 统计、构建时间） | Layout |

---

## 五、状态管理策略

### 5.1 Store 设计（Zustand）

```typescript
// stores/wikiStore.ts
interface WikiState {
  // 数据
  graphData: GraphData | null;
  indexData: ParsedIndex | null;
  logEntries: LogEntry[];

  // UI 状态
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  searchQuery: string;
  selectedNodeId: string | null;

  // 加载状态
  loading: boolean;
  error: string | null;

  // Actions
  fetchGraphData: () => Promise<void>;
  fetchIndex: () => Promise<void>;
  fetchLog: () => Promise<void>;
  setTheme: (theme: "light" | "dark") => void;
  toggleSidebar: () => void;
  setSelectedNode: (id: string | null) => void;
  getNodeById: (id: string) => GraphNode | undefined;
  searchPages: (query: string) => SearchResult[];
}
```

### 5.2 数据流

```
graph.json ──fetch──> wikiStore.graphData ──selector──> 组件
index.md  ──fetch──> wikiStore.indexData  ──selector──> 组件
log.md    ──fetch──> wikiStore.logEntries  ──selector──> 组件

用户操作 ──dispatch──> wikiStore.action() ──re-render──> 组件
```

### 5.3 缓存策略

- `graphData` 在首次加载后缓存到内存，不重复请求
- 使用 `stale-while-revalidate` 模式：先展示缓存数据，后台静默刷新
- 页面级 markdown 内容已在 `graphData.nodes[].markdown` 中，无需额外请求

---

## 六、路由配置

### 6.1 路由表

```typescript
// router.tsx
const routes = [
  { path: "/", element: <DashboardPage /> },
  { path: "/graph", element: <GraphPage /> },
  { path: "/sources", element: <SourceListPage /> },
  { path: "/sources/:slug", element: <PageDetailPage type="source" /> },
  { path: "/entities", element: <EntityListPage /> },
  { path: "/entities/:name", element: <PageDetailPage type="entity" /> },
  { path: "/concepts", element: <ConceptListPage /> },
  { path: "/concepts/:name", element: <PageDetailPage type="concept" /> },
  { path: "/syntheses", element: <SynthesisListPage /> },
  { path: "/syntheses/:slug", element: <PageDetailPage type="synthesis" /> },
  { path: "/log", element: <LogPage /> },
  { path: "/search", element: <SearchPage /> },
  { path: "*", element: <NotFoundPage /> },
];
```

### 6.2 Wikilink → 路由映射规则

`[[PageName]]` 在渲染时需要解析为目标路由：

```typescript
function resolveWikiLink(linkText: string, nodes: GraphNode[]): string {
  const node = nodes.find(
    (n) => n.label === linkText || n.id.endsWith(`/${linkText}`)
  );
  if (!node) return `/search?q=${encodeURIComponent(linkText)}`;
  return `/${node.type}s/${node.id.split("/").pop()}`;
}
```

---

## 七、样式方案

### 7.1 Tailwind 配置（自定义主题）

```javascript
// tailwind.config.js
module.exports = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        peach: {
          50: "#FFF0ED",
          100: "#FFE0D6",
          200: "#FFB5A7",
          300: "#FF8C73",
          400: "#FF6B4A",
        },
        lavender: {
          50: "#F3EDFA",
          100: "#E4D9F5",
          200: "#CDB4DB",
          300: "#B48EDA",
          400: "#9B6BC7",
        },
        cream: {
          50: "#FFFDF7",
          100: "#FEFAE0",
          200: "#FFF3C4",
        },
        clay: {
          shadow: "rgba(0, 0, 0, 0.06)",
          highlight: "rgba(255, 255, 255, 0.6)",
        },
      },
      fontFamily: {
        title: ["Fredoka", "sans-serif"],
        body: ["Quicksand", "sans-serif"],
        code: ["Fira Code", "monospace"],
      },
      borderRadius: {
        clay: "16px",
        "clay-lg": "24px",
        "clay-xl": "32px",
      },
      boxShadow: {
        clay:
          "6px 6px 12px rgba(0,0,0,0.08), -6px -6px 12px rgba(255,255,255,0.6)",
        "clay-inset":
          "inset 4px 4px 8px rgba(0,0,0,0.06), inset -4px -4px 8px rgba(255,255,255,0.5)",
        "clay-hover":
          "8px 8px 16px rgba(0,0,0,0.1), -8px -8px 16px rgba(255,255,255,0.7)",
      },
      animation: {
        jelly: "jelly 0.5s cubic-bezier(0.25, 0.8, 0.25, 1.4)",
        bounce_soft: "bounce_soft 2s infinite",
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        jelly: {
          "0%, 100%": { transform: "scale(1)" },
          "25%": { transform: "scale(0.95)" },
          "50%": { transform: "scale(1.05)" },
          "75%": { transform: "scale(0.98)" },
        },
        bounce_soft: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-10px) rotate(2deg)" },
        },
      },
    },
  },
  plugins: [],
};
```

### 7.2 Claymorphism 通用样式

```css
/* Clay 组件基础样式 */
.clay-card {
  @apply bg-cream-50 rounded-clay-lg shadow-clay
         border border-white/40 backdrop-blur-sm
         transition-all duration-300 ease-out;
}
.clay-card:hover {
  @apply shadow-clay-hover -translate-y-0.5;
}

.clay-button {
  @apply bg-peach-200 text-white rounded-clay shadow-clay
         px-6 py-2.5 font-title font-medium
         transition-all duration-200 ease-out
         active:shadow-clay-inset active:scale-95;
}
.clay-button:hover {
  @apply bg-peach-300 shadow-clay-hover animate-jelly;
}

.clay-input {
  @apply bg-cream-50 rounded-clay shadow-clay-inset
         px-4 py-2.5 font-body
         border border-white/30
         focus:outline-none focus:ring-2 focus:ring-lavender-200;
}
```

### 7.3 深浅色模式

```css
/* 深色模式覆盖 */
.dark {
  --bg-primary: #1a1a2e;
  --bg-card: #252542;
  --text-primary: #f1f2f7;
  --text-secondary: #9ea3b0;
}
.dark .clay-card {
  @apply bg-[var(--bg-card)] shadow-none
         border border-white/5;
}
```

---

## 八、接口对接规范

### 8.1 数据获取方式

由于 wiki 数据完全是本地文件，采用 **两种并行策略**：

#### 策略 A：纯静态模式（零后端）

将 `graph.json` 和其他数据文件复制到 React 的 `public/` 目录，Vite 直接作为静态资源提供：

```typescript
// services/dataService.ts
const DATA_BASE = import.meta.env.BASE_URL;

export async function fetchGraphData(): Promise<GraphData> {
  const res = await fetch(`${DATA_BASE}data/graph.json`);
  if (!res.ok) throw new Error(`Failed to load graph: ${res.status}`);
  return res.json();
}

export async function fetchMarkdown(relativePath: string): Promise<string> {
  const res = await fetch(`${DATA_BASE}${relativePath}`);
  if (!res.ok) throw new Error(`Failed to load: ${relativePath}`);
  return res.text();
}
```

构建时用脚本同步数据文件：

```bash
# scripts/sync-data.sh（或 .ps1 for Windows）
cp graph/graph.json wiki-viewer/public/data/
cp wiki/index.md wiki-viewer/public/data/wiki/index.md
cp wiki/overview.md wiki-viewer/public/data/wiki/overview.md
cp wiki/log.md wiki-viewer/public/data/wiki/log.md
cp -r wiki/sources wiki-viewer/public/data/wiki/
cp -r wiki/entities wiki-viewer/public/data/wiki/
cp -r wiki/concepts wiki-viewer/public/data/wiki/
cp -r wiki/syntheses wiki-viewer/public/data/wiki/
```

#### 策略 B：轻量后端 API（推荐，功能更完整）

添加一个 Python FastAPI 服务（~50 行），提供以下 API：

| 端点 | 方法 | 说明 |
|---|---|---|
| `GET /api/graph` | GET | 返回 graph.json |
| `GET /api/pages/:type/:slug` | GET | 返回指定页面的 markdown |
| `GET /api/index` | GET | 返回解析后的 index 结构 |
| `GET /api/log` | GET | 返回解析后的日志列表 |
| `GET /api/search?q=keyword` | GET | 全文搜索（服务端执行） |
| `GET /api/health` | GET | 返回 health check 结果 |

```python
# tools/api_server.py（新增文件，约 80 行）
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import json

app = FastAPI(title="LLM Wiki API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"])

REPO = Path(__file__).parent.parent
WIKI = REPO / "wiki"
GRAPH = REPO / "graph"

@app.get("/api/graph")
def get_graph():
    data = (GRAPH / "graph.json").read_text(encoding="utf-8")
    return json.loads(data)

@app.get("/api/pages/{page_type}/{slug}")
def get_page(page_type: str, slug: str):
    path = WIKI / page_type / f"{slug}.md"
    if not path.exists():
        return {"error": "Not found"}, 404
    return {"markdown": path.read_text(encoding="utf-8"), "path": str(path)}

@app.get("/api/search")
def search(q: str = Query("")):
    results = []
    for p in WIKI.rglob("*.md"):
        if p.name in ("index.md", "log.md", "lint-report.md"):
            continue
        content = p.read_text(encoding="utf-8")
        if q.lower() in content.lower():
            results.append({
                "id": p.relative_to(WIKI).as_posix().replace(".md", ""),
                "path": str(p.relative_to(REPO)),
                "preview": content[:200],
            })
    return {"results": results, "total": len(results)}

# 开发模式：同时 serve 前端静态文件
# app.mount("/", StaticFiles(directory="wiki-viewer/dist", html=True), name="spa")
```

### 8.2 自定义 Hooks 封装

```typescript
// hooks/useGraphData.ts
function useGraphData() {
  const { graphData, loading, error, fetchGraphData } = useWikiStore();
  useEffect(() => {
    if (!graphData) fetchGraphData();
  }, []);
  return { graphData, loading, error };
}

// hooks/usePage.ts
function usePage(type: string, slug: string) {
  const { graphData } = useGraphData();
  const node = graphData?.nodes.find(
    (n) => n.id === `${type}s/${slug}` || n.id === slug
  );
  return {
    node,
    markdown: node?.markdown ?? null,
    meta: node ? parseFrontmatter(node.markdown) : null,
    backLinks: graphData
      ? graphData.edges
          .filter((e) => e.to === node?.id)
          .map((e) => graphData.nodes.find((n) => n.id === e.from))
          .filter(Boolean)
      : [],
  };
}

// hooks/useSearch.ts
function useSearch(query: string) {
  const { graphData } = useGraphData();
  return useMemo(() => {
    if (!query || !graphData) return [];
    const q = query.toLowerCase();
    return graphData.nodes.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.markdown.toLowerCase().includes(q) ||
        n.preview.toLowerCase().includes(q)
    );
  }, [query, graphData]);
}
```

---

## 九、性能优化措施

### 9.1 数据加载优化

| 措施 | 说明 |
|---|---|
| **graph.json 增量加载** | 首次加载 graph.json 后缓存至 Zustand store，后续页面切换不再重复请求 |
| **路由懒加载** | 所有页面组件使用 `React.lazy` + `Suspense`，按需加载 |
| **Markdown 虚拟渲染** | 长文档使用虚拟滚动（`react-window`），只渲染可视区域 |
| **搜索防抖** | 全局搜索输入 300ms 防抖，避免频繁计算 |
| **Web Worker 搜索** | 大型 wiki 的全文搜索放入 Web Worker，避免阻塞主线程 |

### 9.2 渲染优化

```typescript
// 页面列表使用 memo 避免不必要的重渲染
const PageCard = React.memo(({ node }: { node: GraphNode }) => {
  // ...
});

// 图谱节点过滤使用 useMemo
const filteredNodes = useMemo(
  () => nodes.filter((n) => activeTypes.includes(n.type)),
  [nodes, activeTypes]
);

// Markdown 渲染器使用 useMemo 缓存 AST
const markdownContent = useMemo(
  () => <MarkdownRenderer content={markdown} onWikiLinkClick={handleLink} />,
  [markdown]
);
```

### 9.3 构建优化

| 措施 | 说明 |
|---|---|
| **代码分割** | vis-network 单独 chunk（体积大，仅图谱页需要） |
| **Tree Shaking** | Lucide 按需导入、Radix 按需导入 |
| **静态资源内联** | 小型 SVG 图标内联，减少 HTTP 请求 |
| **Gzip/Brotli** | Vite 构建产物启用压缩（graph.json 压缩率 >80%） |
| **Service Worker** | 可选，使用 `vite-plugin-pwa` 实现离线可用 |

---

## 十、测试计划

### 10.1 测试分层

| 层级 | 工具 | 覆盖范围 | 目标覆盖率 |
|---|---|---|---|
| **单元测试** | Vitest | 工具函数、store actions/reducers、hooks | ≥ 80% |
| **组件测试** | React Testing Library | 所有 UI 组件的渲染和交互 | ≥ 70% |
| **集成测试** | React Testing Library | 页面级组件的路由跳转、数据流 | 关键路径 100% |
| **E2E 测试** | Playwright（可选） | 核心用户流程（浏览、搜索、图谱交互） | 核心场景 |

### 10.2 测试重点

```typescript
// 示例：wikilink 解析测试
describe("resolveWikiLink", () => {
  it("should resolve entity link to correct route", () => {
    expect(resolveWikiLink("OpenAI", mockNodes)).toBe("/entities/OpenAI");
  });
  it("should fallback to search for unknown links", () => {
    expect(resolveWikiLink("UnknownThing", mockNodes)).toBe(
      "/search?q=UnknownThing"
    );
  });
});

// 示例：store 测试
describe("WikiStore", () => {
  it("should parse graph data correctly", async () => {
    const { result } = renderHook(() => useWikiStore());
    await act(async () => {
      await result.current.fetchGraphData();
    });
    expect(result.current.graphData?.nodes).toBeDefined();
  });
});

// 示例：组件测试
describe("PageDetailPage", () => {
  it("should render markdown content with wikilinks", () => {
    render(
      <MemoryRouter>
        <PageDetailPage type="source" />
      </MemoryRouter>
    );
    expect(screen.getByText("Summary")).toBeInTheDocument();
  });
});
```

### 10.3 CI 集成

```yaml
# .github/workflows/test.yml（可选）
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: cd wiki-viewer && npm ci && npm test
```

---

## 十一、部署流程

### 11.1 静态部署（推荐）

```bash
# 1. 同步最新数据
python tools/build_graph.py
bash scripts/sync-data.sh   # Windows: scripts/sync-data.ps1

# 2. 构建 React 应用
cd wiki-viewer
npm run build

# 3. 产物在 wiki-viewer/dist/，可直接用任何静态服务器托管
#    - 本地：npx serve dist
#    - GitHub Pages：推送到 gh-pages 分支
#    - Netlify/Vercel：连接仓库自动部署
```

### 11.2 带后端部署

```bash
# 1. 启动 API 服务
pip install fastapi uvicorn
python tools/api_server.py

# 2. 前端构建后由 API 服务统一托管
#    或者前端开发模式代理到 API
cd wiki-viewer && npm run dev
```

### 11.3 集成到现有工作流

在 `build_graph.py` 末尾或自动化脚本中添加一步：

```bash
# 自动构建前端
cd wiki-viewer && npm run build
```

---

## 十二、目录结构示例

```
llm-wiki-agent/
├── wiki-viewer/                    # React 前端子项目
│   ├── public/
│   │   ├── data/                   # 静态数据（由 sync 脚本复制）
│   │   │   ├── graph.json
│   │   │   └── wiki/
│   │   │       ├── index.md
│   │   │       ├── overview.md
│   │   │       ├── log.md
│   │   │       ├── sources/
│   │   │       ├── entities/
│   │   │       ├── concepts/
│   │   │       └── syntheses/
│   │   ├── fonts/                  # 自托管字体
│   │   │   ├── Fredoka-Variable.woff2
│   │   │   ├── Quicksand-Variable.woff2
│   │   │   └── FiraCode-Variable.woff2
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Layout.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── StatusBar.tsx
│   │   │   │   └── Breadcrumb.tsx
│   │   │   ├── pages/
│   │   │   │   ├── DashboardPage.tsx
│   │   │   │   ├── GraphPage.tsx
│   │   │   │   ├── SourceListPage.tsx
│   │   │   │   ├── EntityListPage.tsx
│   │   │   │   ├── ConceptListPage.tsx
│   │   │   │   ├── SynthesisListPage.tsx
│   │   │   │   ├── PageDetailPage.tsx
│   │   │   │   ├── LogPage.tsx
│   │   │   │   ├── SearchPage.tsx
│   │   │   │   └── NotFoundPage.tsx
│   │   │   ├── graph/
│   │   │   │   ├── GraphCanvas.tsx
│   │   │   │   ├── GraphControls.tsx
│   │   │   │   └── GraphNodeDrawer.tsx
│   │   │   ├── markdown/
│   │   │   │   ├── MarkdownRenderer.tsx
│   │   │   │   └── WikiLink.tsx
│   │   │   ├── common/
│   │   │   │   ├── PageCard.tsx
│   │   │   │   ├── TagCloud.tsx
│   │   │   │   ├── BackLinks.tsx
│   │   │   │   ├── EmptyState.tsx
│   │   │   │   ├── SearchBar.tsx
│   │   │   │   └── ThemeToggle.tsx
│   │   │   └── ui/
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       ├── Card.tsx
│   │   │       ├── Badge.tsx
│   │   │       ├── Tabs.tsx
│   │   │       └── Skeleton.tsx
│   │   ├── stores/
│   │   │   ├── wikiStore.ts
│   │   │   └── uiStore.ts
│   │   ├── hooks/
│   │   │   ├── useGraphData.ts
│   │   │   ├── usePage.ts
│   │   │   ├── useSearch.ts
│   │   │   └── useTheme.ts
│   │   ├── services/
│   │   │   ├── dataService.ts
│   │   │   └── searchService.ts
│   │   ├── utils/
│   │   │   ├── frontmatter.ts
│   │   │   ├── wikilink.ts
│   │   │   ├── markdown.ts
│   │   │   └── cn.ts
│   │   ├── types/
│   │   │   ├── graph.ts
│   │   │   ├── wiki.ts
│   │   │   └── index.ts
│   │   ├── styles/
│   │   │   ├── globals.css
│   │   │   └── clay.css
│   │   ├── router.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── __tests__/
│   │   ├── utils/
│   │   │   ├── frontmatter.test.ts
│   │   │   └── wikilink.test.ts
│   │   ├── components/
│   │   │   ├── PageCard.test.tsx
│   │   │   └── MarkdownRenderer.test.tsx
│   │   └── stores/
│   │       └── wikiStore.test.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── package.json
├── scripts/
│   ├── sync-data.sh
│   └── sync-data.ps1
├── tools/
│   └── api_server.py               # 新增：轻量 API 服务
├── wiki/
├── graph/
└── ...
```

---

## 十三、关键代码片段

### 13.1 Frontmatter 解析器

```typescript
// utils/frontmatter.ts
export interface PageMeta {
  title: string;
  type: "source" | "entity" | "concept" | "synthesis";
  tags: string[];
  sources: string[];
  last_updated: string;
  [key: string]: unknown;
}

export function parseFrontmatter(raw: string): {
  meta: PageMeta | null;
  body: string;
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: null, body: raw };

  const yamlStr = match[1];
  const body = match[2];

  const meta: Record<string, unknown> = {};
  for (const line of yamlStr.split("\n")) {
    const [key, ...rest] = line.split(":");
    if (!key || !rest.length) continue;
    let value: unknown = rest.join(":").trim();
    if ((value as string).startsWith("[") && (value as string).endsWith("]")) {
      value = (value as string)
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/["']/g, ""));
    }
    if ((value as string).startsWith('"') && (value as string).endsWith('"')) {
      value = (value as string).slice(1, -1);
    }
    meta[key.trim()] = value;
  }

  return { meta: meta as PageMeta, body };
}
```

### 13.2 WikiLink 渲染组件

```tsx
// components/markdown/WikiLink.tsx
import { useNavigate } from "react-router-dom";
import { useWikiStore } from "@/stores/wikiStore";

interface WikiLinkProps {
  target: string;
  children: React.ReactNode;
}

export function WikiLink({ target, children }: WikiLinkProps) {
  const navigate = useNavigate();
  const nodes = useWikiStore((s) => s.graphData?.nodes ?? []);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const node = nodes.find(
      (n) =>
        n.label.toLowerCase() === target.toLowerCase() ||
        n.id.endsWith(`/${target}`)
    );
    if (node) {
      navigate(`/${node.type}s/${node.id.split("/").pop()}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(target)}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="text-peach-400 font-semibold hover:underline
                 bg-peach-100/30 dark:bg-peach-400/10 px-1 rounded
                 transition-colors duration-200 cursor-pointer"
    >
      {children}
    </button>
  );
}
```

### 13.3 MarkdownRenderer 组件

```tsx
// components/markdown/MarkdownRenderer.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { WikiLink } from "./WikiLink";

interface Props {
  content: string;
}

export function MarkdownRenderer({ content }: Props) {
  const { body } = parseFrontmatter(content);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => <a href={href}>{children}</a>,
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className ?? "");
          const code = String(children).replace(/\n$/, "");
          if (match) {
            return (
              <SyntaxHighlighter
                language={match[1]}
                PreTag="div"
                className="rounded-clay !bg-cream-50 dark:!bg-gray-900"
              >
                {code}
              </SyntaxHighlighter>
            );
          }
          return (
            <code
              className="bg-lavender-50 dark:bg-lavender-400/10
                         text-lavender-400 px-1.5 py-0.5 rounded-md
                         font-code text-sm"
              {...props}
            >
              {children}
            </code>
          );
        },
        // 将 [[WikiLink]] 文本转换为可点击链接
        p: ({ children }) => {
          const processed = processWikiLinks(children);
          return <p>{processed}</p>;
        },
      }}
    >
      {body}
    </ReactMarkdown>
  );
}

function processWikiLinks(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") {
    const parts = children.split(/(\[\[[^\]]+\]\])/g);
    if (parts.length === 1) return children;
    return parts.map((part, i) => {
      const match = part.match(/^\[\[([^\]]+)\]\]$/);
      if (match) {
        return (
          <WikiLink key={i} target={match[1]}>
            {match[1]}
          </WikiLink>
        );
      }
      return part;
    });
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => (
      <React.Fragment key={i}>{processWikiLinks(child)}</React.Fragment>
    ));
  }
  return children;
}
```

### 13.4 Zustand Store

```typescript
// stores/wikiStore.ts
import { create } from "zustand";
import { fetchGraphData, fetchMarkdown } from "@/services/dataService";
import type { GraphData, GraphNode } from "@/types/graph";

interface WikiState {
  graphData: GraphData | null;
  theme: "light" | "dark";
  loading: boolean;
  error: string | null;
  fetchGraphData: () => Promise<void>;
  setTheme: (theme: "light" | "dark") => void;
  getNodeById: (id: string) => GraphNode | undefined;
  searchNodes: (query: string) => GraphNode[];
}

export const useWikiStore = create<WikiState>((set, get) => ({
  graphData: null,
  theme: (localStorage.getItem("theme") as "light" | "dark") ?? "light",
  loading: false,
  error: null,

  fetchGraphData: async () => {
    if (get().graphData) return;
    set({ loading: true, error: null });
    try {
      const data = await fetchGraphData();
      set({ graphData: data, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  setTheme: (theme) => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    set({ theme });
  },

  getNodeById: (id) => {
    return get().graphData?.nodes.find((n) => n.id === id);
  },

  searchNodes: (query) => {
    const { graphData } = get();
    if (!graphData || !query) return [];
    const q = query.toLowerCase();
    return graphData.nodes.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.preview.toLowerCase().includes(q) ||
        n.markdown.toLowerCase().includes(q)
    );
  },
}));
```

### 13.5 图谱可视化组件

```tsx
// components/graph/GraphCanvas.tsx
import { useEffect, useRef } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import { useWikiStore } from "@/stores/wikiStore";
import type { GraphNode } from "@/types/graph";

interface Props {
  onNodeClick: (node: GraphNode) => void;
}

export function GraphCanvas({ onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { graphData } = useWikiStore();

  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    const nodes = new DataSet(
      graphData.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        color: {
          background: n.color,
          border: n.color,
          highlight: { background: n.color, border: "#fff" },
        },
        value: n.value,
        title: n.preview,
      }))
    );

    const edges = new DataSet(
      graphData.edges.map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        color: { color: e.color, highlight: "#fff" },
        width: e.type === "EXTRACTED" ? 1.5 : 0.8,
        dashes: e.type === "AMBIGUOUS",
        arrows: "to",
      }))
    );

    const network = new Network(containerRef.current, { nodes, edges }, {
      physics: {
        barnesHut: {
          gravitationalConstant: -5000,
          springLength: 150,
          springConstant: 0.02,
        },
      },
      interaction: { hover: true, tooltipDelay: 150 },
      nodes: {
        shape: "dot",
        font: { color: "#ddd", size: 12, strokeWidth: 3, strokeColor: "#111" },
        scaling: { min: 8, max: 40 },
      },
    });

    network.on("click", (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = graphData.nodes.find((n) => n.id === nodeId);
        if (node) onNodeClick(node);
      }
    });

    return () => network.destroy();
  }, [graphData, onNodeClick]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-clay-lg bg-gray-900"
    />
  );
}
```

---

## 十四、开发里程碑

### M1：项目骨架与核心数据流（第 1 周）

| 任务 | 交付物 |
|---|---|
| Vite + React + TS 项目初始化 | 可运行的空项目 |
| Tailwind + 自定义主题配置 | clay 通用样式可用 |
| graph.json 数据加载（Zustand store） | `/api/graph` → store → 组件 |
| Frontmatter 解析器 | `parseFrontmatter` 工具函数 + 测试 |
| 路由框架搭建 | 所有路由可访问（空页面） |

**验收标准：** `npm run dev` 启动后可看到空壳页面，graph.json 数据成功加载到 store。

### M2：页面浏览功能（第 2 周）

| 任务 | 交付物 |
|---|---|
| MarkdownRenderer + WikiLink 组件 | `[[wikilinks]]` 可点击跳转 |
| PageDetailPage | 展示完整 markdown + frontmatter 元数据 |
| SourceListPage / EntityListPage / ConceptListPage | 三种列表页 |
| Sidebar 导航 | 类型筛选 + 快速跳转 |
| 面包屑 + 反向链接 | BackLinks 组件 |

**验收标准：** 可浏览所有 wiki 页面，wikilink 跳转正常，反向链接正确展示。

### M3：知识图谱可视化（第 3 周）

| 任务 | 交付物 |
|---|---|
| GraphCanvas 组件 | vis-network 渲染 |
| GraphControls 控制面板 | 类型过滤、置信度滑块、搜索 |
| GraphNodeDrawer 节点详情 | 点击节点弹出详情抽屉 |
| 社区着色 + 图例 | 按 community 分组着色 |

**验收标准：** 图谱页面功能与现有 graph.html 等价，交互体验更优。

### M4：搜索与仪表盘（第 4 周）

| 任务 | 交付物 |
|---|---|
| 全文搜索（前端 + 可选后端） | SearchPage + Ctrl+K 快捷键 |
| DashboardPage 总览 | 统计卡片 + 最近更新 + 健康状态 |
| LogPage 操作日志 | 时间线展示 |
| 空状态处理 | EmptyState 组件 + 引导文案 |

**验收标准：** 搜索结果准确、仪表盘数据正确、日志可浏览。

### M5：打磨与发布（第 5 周）

| 任务 | 交付物 |
|---|---|
| 深浅色模式完善 | 两种模式均美观可用 |
| 响应式适配 | 移动端可用 |
| 动画与交互打磨 | 果冻按钮、Q 弹过渡、骨架屏 |
| 测试补充 | 单元测试 + 组件测试 |
| 构建与部署脚本 | `npm run build` + sync-data 脚本 |

**验收标准：** 构建产物可直接部署，所有测试通过，深浅色模式切换正常。

---

## 十五、验收标准

### 功能验收

| 编号 | 验收项 | 标准 |
|---|---|---|
| F-01 | 页面浏览 | 可浏览 source / entity / concept / synthesis 四种类型的所有页面 |
| F-02 | Wikilink 跳转 | 点击 `[[PageName]]` 正确跳转到目标页面，未找到则跳转搜索 |
| F-03 | 反向链接 | 页面详情底部展示"谁链接到当前页"的反向链接列表 |
| F-04 | 知识图谱 | vis-network 渲染与现有 graph.html 功能对齐 |
| F-05 | 全文搜索 | 搜索结果按相关度排序，高亮匹配文本 |
| F-06 | 仪表盘 | 展示节点数、边数、社区数、最近更新等统计信息 |
| F-07 | 操作日志 | 时间线展示所有 ingest / query / lint / graph 操作 |
| F-08 | 深浅色模式 | 两种模式均可正常使用，切换有过渡动画 |
| F-09 | 空状态 | 无数据时展示友好的引导提示 |

### 非功能验收

| 编号 | 验收项 | 标准 |
|---|---|---|
| NF-01 | 首屏加载 | ≤ 2s（数据已缓存时 ≤ 500ms） |
| NF-02 | 图谱渲染 | 100 节点以内流畅（≥ 30fps） |
| NF-03 | 搜索响应 | 输入后 300ms 内出结果 |
| NF-04 | 构建体积 | 总产物 ≤ 500KB（gzip） |
| NF-05 | 浏览器兼容 | Chrome / Firefox / Edge / Safari 最新 2 个版本 |

---

## 十六、风险预案

| 风险 | 概率 | 影响 | 预案 |
|---|---|---|---|
| **graph.json 体积过大**（大量摄入后可能超 10MB） | 中 | 高 | ① 前端分片加载：仅加载 nodes 元数据，markdown 内容按需请求；② 后端 API 支持分页和字段过滤；③ graph.json 构建时拆分为 `graph-meta.json`（轻量）+ `graph-content/` 目录（按需） |
| **vis-network 大规模图性能下降** | 中 | 中 | ① 超过 200 节点时自动启用聚类视图（按社区折叠）；② 提供"仅展示当前社区"的过滤模式；③ 考虑备选方案：`@antv/g6` 或 `sigma.js`（WebGL 渲染） |
| **CJK 内容搜索准确性** | 低 | 中 | ① 现有 `query.py` 已有 CJK bigram 匹配逻辑，可复用；② 后端搜索使用 Python 的 `re.search` 而非简单 `in` 匹配；③ 考虑引入 `fuse.js` 做前端模糊搜索 |
| **Markdown 渲染与 Obsidian 不一致** | 低 | 低 | ① 使用 `remark-gfm` 确保 GFM 兼容；② wikilink 语法通过自定义 `components.p` 处理；③ 特殊语法（callout `> [!note]`）使用 rehype 插件扩展 |
| **FastAPI 后端额外维护成本** | 低 | 低 | ① 后端完全可选，纯静态模式也能工作；② API 文件控制在 100 行以内；③ 也可用 Node.js（Express）替代，保持技术栈统一 |
| **Vite 代理在 Windows 上的兼容性** | 低 | 低 | ① Vite 在 Windows 上经过充分测试，代理功能稳定；② 提供 `.ps1` 同步脚本作为备选 |
| **字体加载影响首屏性能** | 低 | 低 | ① 使用 `font-display: swap`；② 字体文件自托管到 `public/fonts/`；③ 使用 woff2 可变字体减小体积 |

---

## 附录 A：环境变量配置

```bash
# wiki-viewer/.env
VITE_API_BASE_URL=http://localhost:8000
VITE_DATA_BASE_URL=/data
VITE_APP_TITLE=LLM Wiki Viewer
```

## 附录 B：npm scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext ts,tsx",
    "format": "prettier --write \"src/**/*.{ts,tsx,css}\"",
    "sync-data": "node scripts/sync-data.mjs"
  }
}
```

## 附录 C：与现有工具链的关系

```
现有工具链（Python）          新增前端（React）
─────────────────────       ──────────────────
ingest.py → wiki/*.md  ──→  React 读取并渲染
build_graph.py → graph.json → React 图谱可视化
health.py → health-report  → React 仪表盘展示
lint.py → lint-report      → React 仪表盘展示
query.py → syntheses/      → React 页面浏览

新增文件：
  tools/api_server.py       （可选，~80 行 FastAPI）
  scripts/sync-data.ps1     （数据同步脚本）
  wiki-viewer/              （React 前端项目）
```

**核心原则：不修改任何现有 Python 工具脚本**，前端只是新增一个读取层。
