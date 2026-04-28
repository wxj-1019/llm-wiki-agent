# i18n 国际化实现方案

> 文档版本: 1.1 | 日期: 2026-04-28 | 状态: 已评审

---

## 1. 背景与目标

### 1.1 现状

`wiki-viewer/` 前端当前**全部字符串为英文硬编码**，无任何国际化基础设施。经审计：

- **活跃代码中可翻译字符串**: 65 条
- **去重后唯一 key**: 约 42 条
- **涉及文件**: 11 个组件/服务
- **无中文字符串**

### 1.2 目标

| 目标 | 说明 |
|---|---|
| **多语言支持** | 首批支持 `en`（英文）+ `zh-CN`（简体中文） |
| **运行时切换** | 用户可在设置中切换语言，无需刷新页面 |
| **可扩展** | 后续添加新语言（如 `ja`、`ko`）只需新增 2 个 JSON 文件 |
| **零破坏** | 所有现有功能不变，默认语言保持英文 |
| **类型安全** | 翻译 key 有 TypeScript 类型检查，遗漏 key 编译报错 |

---

## 2. 技术选型

### 2.1 候选方案对比

| 方案 | 包大小 | TypeScript 支持 | 复数/插值 | React 集成 | 维护状态 |
|---|---|---|---|---|---|
| **react-i18next** | ~40KB (gzip ~12KB) | ✅ 优秀 | ✅ ICU | ✅ `useTranslation` hook | 活跃 |
| react-intl (FormatJS) | ~60KB | ✅ 良好 | ✅ ICU | ✅ `useIntl` hook | 活跃 |
| 自建轻量方案 | 0 | 需手写 | 需手写 | 需手写 | — |
| lingui | ~5KB | ✅ 良好 | ✅ ICU | ✅ | 活跃 |

### 2.2 决策: react-i18next

**理由:**

1. **生态最成熟** — npm 周下载量 > react-intl 的 3 倍，社区资源丰富
2. **TypeScript 类型推导** — 通过 JSON 资源文件自动推断类型，无需手动维护
3. **ICU MessageFormat** — 内建 `{count, plural}` 和 `{var}` 插值
4. **React 集成简洁** — `useTranslation()` hook + `<Trans>` 组件覆盖所有场景
5. **与现有技术栈兼容** — 不与 React 18 / Vite / TailwindCSS 冲突

### 2.3 依赖清单

```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

> 不引入 `i18next-http-backend`：项目仅 42 个 key，翻译文件随 Vite 静态打包，无需运行时 HTTP 加载。

---

## 3. 文件结构设计

```
wiki-viewer/src/
├── i18n/
│   ├── index.ts              # i18next 初始化配置
│   └── locales/
│       ├── en.json           # 英文翻译（~42 条 key）
│       └── zh-CN.json        # 简体中文翻译
```

**为什么只保留 2 个 JSON 文件？**

项目规模极小（42 个 key），拆成多个命名空间会带来以下负担：
- 初始化时需要 N 倍 import 语句
- 组件调用时需要指定命名空间 `useTranslation('xxx')`
- 新增 key 时需要先判断放哪个命名空间

单文件结构在 50 个 key 以内完全可读；超过 100 条时再考虑按页面拆分。

---

## 4. 翻译 Key 命名规范

### 4.1 命名规则

```
{category}.{element}.{variant}
```

| 层级 | 说明 | 示例 |
|---|---|---|
| category | 功能域 | `nav`, `type`, `stat`, `greeting`, `empty` |
| element | 具体元素 | `home`, `sources`, `placeholder`, `title` |
| variant | 变体（可选） | `morning`, `afternoon`, `evening` |

### 4.2 Key 清单（去重后 42 条）

#### 全局键

```json
{
  "nav.home": "Home",
  "nav.browse": "Browse",
  "nav.sources": "Sources",
  "nav.entities": "Entities",
  "nav.concepts": "Concepts",
  "nav.syntheses": "Syntheses",
  "nav.graph": "Graph",
  "nav.log": "Log",

  "type.source": "Source",
  "type.entity": "Entity",
  "type.concept": "Concept",
  "type.synthesis": "Synthesis",

  "stat.sources": "Sources",
  "stat.entities": "Entities",
  "stat.concepts": "Concepts",
  "stat.syntheses": "Syntheses",
  "stat.nodes": "Nodes",
  "stat.edges": "Edges",
  "stat.communities": "Communities",

  "action.search": "Search",
  "action.explore": "Explore",
  "action.backToHome": "Back to Home",
  "action.switchLanguage": "Switch language",
  "shortcut.ctrlK": "Ctrl K",

  "brand.name": "LLM Wiki",
  "meta.title": "LLM Wiki Viewer"
}
```

#### 页面键

```json
{
  "greeting.morning": "Good morning~",
  "greeting.afternoon": "Good afternoon~",
  "greeting.evening": "Good evening~",
  "home.subtitle": "What do you want to explore today?",
  "home.searchPlaceholder": "Search your knowledge base...",
  "home.sections.knowledgeGraph": "Knowledge Graph",
  "home.sections.continueReading": "Continue Reading",
  "home.sections.randomDiscovery": "Random Discovery",

  "browse.title": "Browse Library",
  "browse.filterAll": "All",
  "browse.filterPlaceholder": "Filter pages...",
  "browse.empty.title": "No pages found",
  "browse.empty.description": "Try a different search term",

  "detail.notFound": "Page not found",
  "detail.breadcrumb.browse": "Browse",
  "detail.updated": "Updated {{date}}",
  "detail.backlinks_one": "Linked from (1 page)",
  "detail.backlinks_other": "Linked from ({{count}} pages)",

  "search.title": "Search",
  "search.placeholder": "Search across all wiki pages...",
  "search.resultCount_one": "1 result for \"{{query}}\"",
  "search.resultCount_other": "{{count}} results for \"{{query}}\"",
  "search.empty.title": "No results found",
  "search.empty.description": "Try different keywords",

  "graph.connections_one": "1 connection",
  "graph.connections_other": "{{count}} connections",
  "graph.tooltip": "Knowledge Graph",

  "log.title": "Operation Log",
  "log.empty.title": "No logs yet",
  "log.empty.description": "Operations will appear here",

  "notFound.title": "Page not found",
  "notFound.description": "This page doesn't exist in the wiki.",
  "notFound.backToHome": "Back to Home"
}
```

> 注：`home.`、`browse.` 等前缀用于在单文件内逻辑分组，不影响运行时行为。

---

## 5. 实现步骤

### Phase 1: 基础设施（搭建 i18n 框架）

#### Task 1.1: 安装依赖

```bash
cd wiki-viewer
npm install i18next react-i18next i18next-browser-languagedetector
```

#### Task 1.2: 创建翻译文件

按第 4 节的 Key 清单，创建 `src/i18n/locales/en.json` 和 `src/i18n/locales/zh-CN.json`。

#### Task 1.3: 初始化 i18next

创建 `src/i18n/index.ts`:

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

// 自动推断翻译 key 类型
type Resources = typeof en;

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: Resources };
  }
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      'zh-CN': { translation: zhCN },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React 已做 XSS 防护
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'wiki-lang',
    },
  });

export default i18n;
```

#### Task 1.4: 在入口引入

在 `src/main.tsx` 顶部添加:

```typescript
import './i18n';
```

#### Task 1.5: 动态修改 document.title

在 `src/i18n/index.ts` 底部添加监听：

```typescript
// 同步 document.title 到当前语言
function updateTitle() {
  document.title = i18n.t('meta.title');
}

i18n.on('languageChanged', updateTitle);
updateTitle();
```

#### Task 1.6: 验证基础框架

启动 `npm run dev`，确认:
- 编译无报错
- 页面正常渲染
- 浏览器 localStorage 中 `wiki-lang` 键不存在时默认使用英文
- `document.title` 显示为 "LLM Wiki Viewer"

---

### Phase 2: 组件迁移（替换硬编码字符串）

各 Task 之间无依赖，可并行执行。

#### Task 2.1: Sidebar.tsx

将 `navItems` 的 `label` 替换为 `translationKey`，组件内使用 `t()`：

```typescript
import { useTranslation } from 'react-i18next';

const navItems = [
  { icon: Home, key: 'nav.home', path: '/' },
  { icon: Compass, key: 'nav.browse', path: '/browse' },
  // ...
];

export function Sidebar() {
  const { t } = useTranslation();
  // ...
  <span>{t(item.key)}</span>
}
```

#### Task 2.2: GlassHeader.tsx

替换品牌名、搜索按钮、placeholder、tooltip。

#### Task 2.3: HomePage.tsx

替换问候语、副标题、统计标签、分区标题、按钮文本。

**问候语处理:**

```typescript
const { t } = useTranslation();
const hour = new Date().getHours();
const greetingKey =
  hour < 12 ? 'greeting.morning' :
  hour < 18 ? 'greeting.afternoon' :
  'greeting.evening';

// 使用
t(greetingKey)
```

#### Task 2.4: BrowsePage.tsx

替换筛选标签、页面标题、placeholder、空状态。

#### Task 2.5: PageDetailPage.tsx

替换类型名映射、面包屑、元数据标签、反向链接标题。

**类型名映射：**

```typescript
const typeKeyMap: Record<string, string> = {
  source: 'type.source',
  entity: 'type.entity',
  concept: 'type.concept',
  synthesis: 'type.synthesis',
};

// 使用
t(typeKeyMap[type])
```

**复数处理（反向链接）：**

```diff
- {`Linked from (${backlinks.length} pages)`}
+ {t('detail.backlinks', { count: backlinks.length })}
```

对应的 `zh-CN.json`:

```json
{
  "detail.backlinks_one": "1 个页面链接到此页",
  "detail.backlinks_other": "{{count}} 个页面链接到此页"
}
```

**日期本地化：**

```typescript
import { format, parseISO } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import i18n from '@/i18n';

function formatDate(dateStr: string): string {
  const locale = i18n.language === 'zh-CN' ? zhCN : enUS;
  return format(parseISO(dateStr), 'PPP', { locale });
}

// 使用
t('detail.updated', { date: formatDate(meta.last_updated) })
```

#### Task 2.6: SearchPage.tsx

替换标题、placeholder、结果计数、空状态。

**复数处理（结果计数）：**

```diff
- {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
+ {t('search.resultCount', { count: results.length, query })}
```

> i18next 会根据 `count` 自动选择 `resultCount_one` 或 `resultCount_other`。中文两个 key 的值可以相同。

#### Task 2.7: GraphPage.tsx

替换类型筛选标签、连接数后缀。

> 注意：vis-network 节点 `title: n.preview` 是后端返回的 wiki 内容摘要，**不是前端硬编码英文**，无需翻译。

#### Task 2.8: LogPage.tsx + NotFoundPage.tsx

替换标题、空状态、按钮文本。

#### Task 2.9: 清理 Vite 模板残留

删除未使用的文件：
- `src/App.tsx`
- `src/App.css`
- `src/assets/react.svg`

---

### Phase 3: 语言切换 UI

#### Task 3.1: 添加语言切换组件

在 `GlassHeader.tsx` 右侧添加支持多语言的下拉/列表组件：

```tsx
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '@/i18n';

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  return (
    <div className="relative group">
      <button
        className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
        title={t('action.switchLanguage')}
      >
        <Globe size={18} />
      </button>
      <div className="absolute right-0 top-full mt-2 py-1 glass rounded-xl shadow-apple-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all min-w-[140px]">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-secondary)] transition-colors flex items-center justify-between ${
              i18n.language === lang.code ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            {lang.label}
            {i18n.language === lang.code && <Check size={14} />}
          </button>
        ))}
      </div>
    </div>
  );
}
```

#### Task 3.2: 语言持久化

已通过 `i18next-browser-languagedetector` 配置 `localStorage` 持久化，键名 `wiki-lang`。添加新语言时，只需在 `SUPPORTED_LANGUAGES` 数组和 JSON 文件中追加即可，无需修改切换器组件。

---

## 6. 中文翻译参考

```json
{
  "nav.home": "首页",
  "nav.browse": "浏览",
  "nav.sources": "源文档",
  "nav.entities": "实体",
  "nav.concepts": "概念",
  "nav.syntheses": "综合分析",
  "nav.graph": "知识图谱",
  "nav.log": "操作日志",

  "type.source": "源文档",
  "type.entity": "实体",
  "type.concept": "概念",
  "type.synthesis": "综合分析",

  "stat.sources": "源文档",
  "stat.entities": "实体",
  "stat.concepts": "概念",
  "stat.syntheses": "综合分析",
  "stat.nodes": "节点",
  "stat.edges": "边",
  "stat.communities": "社区",

  "action.search": "搜索",
  "action.explore": "探索",
  "action.backToHome": "返回首页",
  "action.switchLanguage": "切换语言",
  "shortcut.ctrlK": "Ctrl K",

  "brand.name": "LLM Wiki",
  "meta.title": "LLM Wiki Viewer",

  "greeting.morning": "早上好~",
  "greeting.afternoon": "下午好~",
  "greeting.evening": "晚上好~",
  "home.subtitle": "今天想探索什么？",
  "home.searchPlaceholder": "搜索知识库...",
  "home.sections.knowledgeGraph": "知识图谱",
  "home.sections.continueReading": "继续阅读",
  "home.sections.randomDiscovery": "随机发现",

  "browse.title": "浏览库",
  "browse.filterAll": "全部",
  "browse.filterPlaceholder": "筛选页面...",
  "browse.empty.title": "未找到页面",
  "browse.empty.description": "请尝试其他搜索词",

  "detail.notFound": "页面未找到",
  "detail.breadcrumb.browse": "浏览",
  "detail.updated": "更新于 {{date}}",
  "detail.backlinks_one": "1 个页面链接到此页",
  "detail.backlinks_other": "{{count}} 个页面链接到此页",

  "search.title": "搜索",
  "search.placeholder": "搜索所有 Wiki 页面...",
  "search.resultCount_one": "1 条关于 \"{{query}}\" 的结果",
  "search.resultCount_other": "共 {{count}} 条关于 \"{{query}}\" 的结果",
  "search.empty.title": "未找到结果",
  "search.empty.description": "请尝试其他关键词",

  "graph.connections_one": "1 个连接",
  "graph.connections_other": "{{count}} 个连接",
  "graph.tooltip": "知识图谱",

  "log.title": "操作日志",
  "log.empty.title": "暂无日志",
  "log.empty.description": "操作记录将显示在这里",

  "notFound.title": "页面未找到",
  "notFound.description": "此页面在 Wiki 中不存在。",
  "notFound.backToHome": "返回首页"
}
```

---

## 7. 注意事项

### 7.1 动态类型渲染

以下位置直接渲染 `node.type` 原始值（如 `source`），依赖 CSS `capitalize` 首字母大写：

- BrowsePage.tsx
- SearchPage.tsx
- GraphPage.tsx
- PageDetailPage.tsx

**修复方案**: 统一使用类型映射函数：

```typescript
const typeKeyMap: Record<string, string> = {
  source: 'type.source',
  entity: 'type.entity',
  concept: 'type.concept',
  synthesis: 'type.synthesis',
};

t(typeKeyMap[type] || 'type.source')
```

### 7.2 复数规则

使用 i18next 原生 plural 后缀机制（`_one` / `_other`），而非手动条件 suffix：

- 组件只需传入 `count`，i18next 自动选择对应 key
- 中文不区分单复数，`_one` 和 `_other` 的值可以相同
- 新增语言时，各语言可按自身 plural rules 定义所需的后缀（如俄语有 `_one` / `_few` / `_many` / `_other`）

### 7.3 日期本地化

PageDetailPage 中的 `Updated {meta.last_updated}` 使用 `date-fns` 进行本地化格式化，而非简单字符串拼接。不同语言的日期格式差异由 `date-fns/locale` 处理。

### 7.4 搜索逻辑不受影响

`dataService.ts` 中的搜索请求参数（如 `?q=keyword`）是协议层面的，不受 i18n 影响。该文件中的 `console.error` 属于开发者调试信息，**不加入国际化**。

### 7.5 图谱可视化（vis-network）

GraphPage 中 vis-network 节点 `title: n.preview` 是后端返回的 wiki 内容摘要，**不是前端硬编码字符串**，无需翻译。需要翻译的只有底部的类型筛选标签和连接数统计。

---

## 8. 验收标准

| # | 标准 | 验证方式 |
|---|---|---|
| 1 | `npm run build` 零错误 | CI |
| 2 | `npm run lint` 零警告 | CI |
| 3 | 英文页面与当前完全一致 | 视觉对比 |
| 4 | 切换中文后所有 65 条字符串均显示中文 | 手动逐页检查 |
| 5 | 刷新页面后语言保持（localStorage 持久化） | 手动验证 |
| 6 | 浏览器语言为中文时自动选择中文 | 修改 `navigator.language` 测试 |
| 7 | 不存在遗漏的硬编码英文 | 运行 `grep -r "t('" src/ | wc -l` 统计已替换数量；人工抽查未覆盖文件 |
| 8 | TypeScript 类型检查通过 | `npx tsc --noEmit` |
| 9 | `document.title` 随语言切换更新 | 手动验证 |
| 10 | 日期格式符合当前语言习惯 | 中文：2024年4月28日；英文：April 28, 2024 |

---

## 9. 工作量估算

| Phase | 任务数 | 涉及文件数 |
|---|---|---|
| Phase 1: 基础设施 | 6 | 2 新建 + 2 修改 |
| Phase 2: 组件迁移 | 9 | 8 修改 + 3 删除 |
| Phase 3: 语言切换 UI | 2 | 1 修改 |
| **合计** | **17** | **2 新建 + 11 修改 + 3 删除** |

---

## 10. 变更日志

### v1.1 (2026-04-28)

- **简化架构**：将 7 个命名空间合并为单文件，减少 14 个 JSON → 2 个 JSON
- **修正依赖**：从清单中移除 `i18next-http-backend`，与实施说明保持一致
- **改进复数**：使用 i18next 原生 `_one` / `_other` 机制，替代手动 suffix
- **改进语言切换器**：从二值切换改为数组驱动的下拉列表，真正支持扩展
- **补充遗漏**：增加 `document.title` 动态翻译和 `date-fns` 日期本地化
- **删除无价值任务**：移除 `dataService.ts` console.error 国际化、Phase 4 手动类型声明
- **修正误判**：说明 GraphPage vis-network tooltip 是后端数据，无需前端翻译
- **增加类型安全**：在初始化文件中通过 `declare module 'i18next'` 自动推断 key 类型
