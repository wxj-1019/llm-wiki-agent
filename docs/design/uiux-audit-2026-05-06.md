# UI/UX 设计评审报告 · LLM Wiki Viewer

> **评审日期**: 2026-05-06  
> **评审范围**: `wiki-viewer/` 前端（React + Tailwind + Framer Motion）  
> **评审维度**: Philosophy / Visual Hierarchy / Detail / Functionality / Innovation  
> **版本**: Round 1（全量） + Round 2（新增功能增量）

---

## 总体评价

LLM Wiki Viewer 是一个以 Apple Design System 为基调、无障碍优先的知识管理前端。整体设计语言清晰（圆角、毛玻璃、柔和阴影、SF Pro 字体栈），键盘导航和 ARIA 覆盖深度超出一般个人项目水平。但在**细节执行**上存在 CSS 类/变量未定义、组件风格漂移等问题，本轮新增功能（标签、社区筛选、MCP 安装向导、批量删除）引入了新的不一致性。

---

## 五维评分

| 维度 | Round 1 | Round 2 | 趋势 |
|------|---------|---------|------|
| Philosophy（哲学一致性） | 7 | 6 | ↓ 新增未定义 CSS 变量和类 |
| Visual Hierarchy（视觉层级） | 7 | 7 | → 新增功能层级合理 |
| Detail Execution（细节执行） | 6 | 5 | ↓ 未定义 token 和原生 select 问题 |
| Functionality（功能性） | 8 | 7 | ↓ 模态框 ARIA 缺失延续 |
| Innovation（创新性） | 6 | 6 | → 信号强度条是亮点 |

---

## Round 1 发现（存量代码）

### 1. Philosophy Consistency · 7/10

**优势**：
- Apple Design 方向明确：`--color-apple-*` token 体系、`.glass` 毛玻璃、药丸形按钮、`1rem` 卡片圆角
- 色彩系统完整，支持明暗主题切换

**问题**：
- **`.apple-button` 与 `.apple-button-warm` 动画不一致**：前者用标准 `0.2s` 过渡，后者加了弹性 `cubic-bezier(0.34,1.56,0.64,1)` 缩放——同一层级按钮两种交互语言
- **`apple-button-primary` 未定义**：`PageDetailPage.tsx:416` 引用了 `apple-button-primary`，但 `index.css` 中从未定义，保存按钮无声回退到无样式文本
- **rounded 字体未加载**：`font-family-rounded` 在首页问候语使用（`font-rounded`），但 Quicksand/Nunito/Comfortaa 未通过 Google Fonts 引入，实际 fallback 到系统 sans

**位置**：`index.css:149-189` · `PageDetailPage.tsx:416` · `HomePage.tsx:96` · `index.css:21-24`

---

### 2. Visual Hierarchy · 7/10

**优势**：
- 首页信息流清晰：greeting → search → stats → favourites → recent → random → graph
- 详情页层级严谨：breadcrumb → type badge + actions → `text-4xl` title → meta → article + TOC → backlinks

**问题**：
- **详情页 action buttons 过密**：7 个按钮（Ask / Edit / Download / Audio / TOC / Favourite）在 flex-wrap 中，<640px 时折成 2-3 行，破坏页面宁静感
- **Sidebar 激活指示器在 collapsed 模式下几乎不可见**：`border-l-2 border-apple-blue` 在 56px 宽度下仅剩 2px 细线
- **Header 搜索下拉固定 `w-80`**：在 iPhone SE（375px）上溢出视口

**位置**：`PageDetailPage.tsx:207-291` · `Sidebar.tsx:77-79` · `Header.tsx:147`

---

### 3. Detail Execution · 6/10

**优势**：
- 自定义 webkit 滚动条、`:selection` 色调、`prefers-reduced-motion` 保护、print 样式
- Markdown 渲染组件全部 `memo` 化（H1, H2, P, UL 等），专家级 React 性能实践
- 代码块 Shiki 高亮 + copy 按钮

**问题**：
- **CodeBlock CopyButton 重复渲染**：`!html` 分支和渲染分支各自渲染一份 CopyButton，违背 DRY
- **RootLayout 硬编码 `pt-[6.5rem]`**：假设只有一条通知横幅；若离线 + PWA 更新 + 安装提示同时出现，padding 不足
- **Collapsed sidebar 图标无 tooltip**：鼠标悬停无法知道图标对应页面

**位置**：`MarkdownRenderer.tsx:94-121` · `RootLayout.tsx:74` · `Sidebar.tsx`

---

### 4. Functionality · 8/10

**优势**：
- 键盘导航全面：CommandPalette ↑↓↵ Esc、搜索 arrow nav、focus trap 包裹模态和 dropdown
- ARIA 深度覆盖：`aria-activedescendant`、`aria-selected`、`aria-current="page"`、role 属性覆盖几乎所有交互元素
- PWA 支持（service worker、install prompt、update banner）、i18n 完整、错误边界

**问题**：
- **缺失 body scroll lock**：CommandPalette、mobile TOC drawer、MCP 安装向导、批量删除确认框打开时，背景页面仍可滚动，破坏模态约定

**位置**：`CommandPalette.tsx:191-293` · `MobileTocDrawer` · `RootLayout.tsx`

---

### 5. Innovation · 6/10

**优势**：
- `AudioOverview` 文本朗读——在个人知识工具中罕见
- `CollabEditor`（Yjs）——单人 wiki 中展示技术野心
- 知识图谱 vis-network 集成 + 动态 CSS 变量主题驱动
- Marshmallow 柔和色系（peach, lavender, sky, mint）注入个性

**问题**：
- 整体布局保守：sidebar + fixed header + centered content 与 Notion/Outline 等上百个知识应用相同
- Marshmallow 色系使用场景有限，仅 `.warm-card` 和 `.empty-state-warm` 出现

---

## Round 2 发现（本轮新增功能）

### BrowsePage · 标签支持 + 更新时间排序

| 评估 | 说明 |
|------|------|
| ✅ 保持 | `PageCard` 信息栈合理：icon + 信号强度条 → title → preview → tags → last_updated / backlinks 底部 |
| ✅ 亮点 | **信号强度指示器**（3 根 3px 竖条，高度 4px/8px/12px）是优雅的信息密度方案，用视觉长度编码 backlink 数量，不占用标签空间 |
| ⚠️ 问题 | **所有标签均为 Apple Blue**，未按页面类型区分颜色。source/entity/concept/synthesis 的 tag 应与各自 type color 一致 |
| ⚠️ 问题 | `last_updated` 显示原始 ISO 日期（`2024-03-15`），过于冗长，应格式化为相对时间（"2 months ago"） |
| ⚠️ 问题 | `+N` 截断指示器（`node.tags.length > 2`）不可点击，用户无法查看剩余标签 |

**位置**：`BrowsePage.tsx:249-324`

---

### GraphPage · 社区筛选

| 评估 | 说明 |
|------|------|
| ✅ 保持 | 社区筛选按钮与类型筛选按钮视觉语言一致（rounded-xl、hover 状态） |
| ⚠️ 问题 | 社区标签显示 "Community 0"、"Community 1"——Louvain 算法 ID 对用户无语义。应自动生成名称（如取该社区中连接数最多的节点名）或至少用字母（Group A / B / C） |
| ⚠️ 问题 | 社区筛选下拉从 `bottom-full` 向上弹出，在工具栏位于页面顶部时空间可能不足 |
| 💡 建议 | 当 `communities.length <= 1` 时应隐藏筛选按钮，避免无用控件 |

**位置**：`GraphPage.tsx:369-440`

---

### MCPPage · 安装向导

| 评估 | 说明 |
|------|------|
| ✅ 保持 | 条件渲染动态表单（npm/pip/url/local/generate）保持表单简洁 |
| ❌ 严重 | **`--accent` 和 `--border-subtle` 未定义**：`bg-[var(--accent)]` 和 `border-[var(--border-subtle)]` 在 `index.css` 中不存在，选中按钮和输入框边框会回退到透明或浏览器默认色 |
| ❌ 严重 | **`btn-primary` / `btn-secondary` 未定义**：安装向导和批量删除对话框使用这两个类，但全局样式中从未声明，按钮呈现为无样式文本 |
| ⚠️ 问题 | 使用原生 `<select>`（类别选择 RAG/Agent/Utility），与玻璃态模态风格冲突，出现 OS 默认下拉框 |
| ⚠️ 问题 | 缺少 focus trap 和 body scroll lock |

**位置**：`MCPPage.tsx:121-258`

---

### UploadPage + FileList · 批量删除

| 评估 | 说明 |
|------|------|
| ✅ 保持 | 两步确认流程（显示确认 → 执行删除 → 结果提示）符合破坏性操作惯例 |
| ⚠️ 问题 | 确认对话框缺少 `role="dialog"` 和 `aria-modal`，键盘用户可 tab 到背景 |
| ⚠️ 问题 | 删除按钮使用 `btn-primary bg-red-500`，"primary" 语义与 "danger" 红色冲突 |

**位置**：`UploadPage.tsx:464-495` · `FileList.tsx`

---

## 行动清单

### 🔒 Keep（保持，不要破坏）

1. **首页 motion stagger** — 0.1–0.5s 级联动画节奏正确，保持现状
2. **ARIA 覆盖深度** — `aria-activedescendant` + `role="listbox"` 模式是生产级质量，新选择器必须复用
3. **Memoised markdown 组件** — H1/H2/P/UL 等 `memo` 化防止大页面不必要重渲染，保持架构
4. **动态图谱主题** — `getComputedColor` 运行时读取 CSS 变量，图谱无需刷新即响应暗色模式
5. **阅读进度持久化** — 500ms debounce 的滚动进度保存/恢复是真正有用的功能
6. **BrowsePage 信号强度条** — 3 柱高度梯度是信息密度的优雅方案，复用于其他基数提示
7. **MCP 向导条件表单** — 按安装方式动态渲染输入框，保持表单整洁

---

### 🔴 Fix（必须修复）

#### 后端/样式层

| # | 问题 | 文件 | 方案 |
|---|------|------|------|
| 1 | `apple-button-primary` 未定义 | `PageDetailPage.tsx:416` | 在 `index.css` 添加 `.apple-button-primary` 规则，或改为 `.apple-button` |
| 2 | `--accent` / `--border-subtle` / `btn-primary` / `btn-secondary` 未定义 | `MCPPage.tsx` · `UploadPage.tsx` | 在 `index.css` 定义： `--accent: #0a84ff; --border-subtle: rgba(0,0,0,0.06);`；`btn-primary` 映射到 `.apple-button`，`btn-secondary` 映射到 `.apple-button-ghost` |
| 3 | rounded 字体未加载 | `index.html` · `HomePage.tsx:96` | 从 Google Fonts 引入 Quicksand/Nunito，或移除 `font-family-rounded` 和 `font-rounded` 使用 |

#### 组件层

| # | 问题 | 文件 | 方案 |
|---|------|------|------|
| 4 | CodeBlock CopyButton 重复 | `MarkdownRenderer.tsx:94-121` | 提取统一 wrapper，只渲染一次 CopyButton |
| 5 | 详情页 action bar 移动端拥挤 | `PageDetailPage.tsx:213-291` | `<640px` 时隐藏按钮文字，只显示图标（`hidden sm:inline`） |
| 6 | Header 搜索下拉溢出 | `Header.tsx:147` | `w-80` 改为 `max-w-[calc(100vw-2rem)]` |
| 7 | Collapsed sidebar 无 tooltip | `Sidebar.tsx:86` | 给 `<Link>` 添加 `title={t(item.translationKey)}` |
| 8 | Sidebar 激活指示器不可见 | `Sidebar.tsx:77` | collapsed 时改用背景 pill 或圆点指示器 |
| 9 | RootLayout padding 硬编码 | `RootLayout.tsx:74` | 用 banner 容器 ref 的 `offsetHeight` 动态计算 |

#### 新增功能层

| # | 问题 | 文件 | 方案 |
|---|------|------|------|
| 10 | 社区名称无语义 | `GraphPage.tsx:432` | 用社区内连接数最多的节点名自动生成标签，或改为 Group A/B/C |
| 11 | MCP 向导原生 `<select>` | `MCPPage.tsx:224` | 用按钮组（button group）替换 RAG/Agent/Utility 选择 |
| 12 | 批量删除对话框缺少 ARIA | `UploadPage.tsx:464` | 添加 `role="dialog" aria-modal="true"`，接入 `useFocusTrap` |
| 13 | 标签颜色无类型区分 | `BrowsePage.tsx:296` | 用 `typeColors` 动态设置 tag 背景色 |
| 14 | 标签截断不可展开 | `BrowsePage.tsx:301` | `+N` 变为可点击，tooltip 或 inline expansion 显示全部 |

---

### ⚡ Quick Wins（5–15 分钟 each）

1. **标签按类型着色** — `BrowsePage.tsx:296` 将 `bg-apple-blue/10 text-apple-blue` 替换为动态 `typeColors`
2. **修复删除按钮语义冲突** — `UploadPage.tsx:488` 将 `btn-primary bg-red-500` 改为显式 `bg-red-500 text-white hover:bg-red-600`
3. **格式化日期为相对时间** — `BrowsePage.tsx:307` 用 `date-fns` 的 `formatDistanceToNow` 替换原始 ISO 字符串
4. **社区筛选空状态隐藏** — `GraphPage.tsx:369` 加 `communities.length > 1` 守卫条件
5. **MCP 向导 Escape 关闭** — 给安装向导容器添加 `onKeyDown={e => e.key === 'Escape' && onClose()}`
6. **PageDetailPage 入场动画** — 将 `initial={{ opacity: 0 }}` 改为 `initial={{ opacity: 0, y: 8 }}` 匹配首页运动语言
7. **Body scroll lock** — 在所有模态/遮罩打开时设置 `document.body.style.overflow = 'hidden'`，关闭时恢复

---

## 附录：关键文件速查

| 文件 | 责任范围 |
|------|----------|
| `wiki-viewer/src/index.css` | 全局 token、Apple 组件类（需补全缺失类） |
| `wiki-viewer/src/components/layout/RootLayout.tsx` | 布局骨架、通知条、padding 计算 |
| `wiki-viewer/src/components/layout/Header.tsx` | 顶部导航、搜索下拉、主题切换 |
| `wiki-viewer/src/components/layout/Sidebar.tsx` | 侧边栏、导航项、激活状态 |
| `wiki-viewer/src/components/pages/HomePage.tsx` | 首页、问候语、统计卡片 |
| `wiki-viewer/src/components/pages/PageDetailPage.tsx` | 详情页、action bar、编辑模式、TOC |
| `wiki-viewer/src/components/pages/BrowsePage.tsx` | 浏览页、标签、排序、信号强度条 |
| `wiki-viewer/src/components/pages/GraphPage.tsx` | 知识图谱、社区筛选、布局编辑 |
| `wiki-viewer/src/components/pages/MCPPage.tsx` | MCP 管理、安装向导 |
| `wiki-viewer/src/components/pages/UploadPage.tsx` | 上传页、批量删除确认 |
| `wiki-viewer/src/components/content/MarkdownRenderer.tsx` | Markdown 渲染、代码块高亮 |
| `wiki-viewer/index.html` | 字体加载入口 |

---

*报告生成于 2026-05-06 · 使用 Critique Skill（5 维度专家评审框架）*
