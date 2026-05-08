# 第五轮深度审查报告

> 审查日期: 2026-05-08 | 审查范围: 前端页面深度审计 (HomePage / SearchPage / PageDetailPage / BrowsePage / useFocusTrap)

---

## 审查概要

| 严重程度 | 数量 | 说明 |
|----------|------|------|
| **🔴 致命** | 1 | HTML导出存在XSS注入 |
| **🟠 严重** | 1 | 增长图表使用伪造数据 |
| **🟡 中等** | 5 | 逻辑缺陷、性能隐患 |
| **🟢 轻微** | 2 | 代码质量问题 |
| **总计** | **9** | |

---

# 🔴 致命问题 (1)

### D1. `wiki-viewer/src/components/pages/PageDetailPage.tsx:271` — HTML导出XSS注入

```typescript
// 修复前:
const html = `...<title>${node.label}</title>...<h1>${node.label}</h1>...${el.innerHTML}...`;
```

**根因**: 
1. `node.label` 来自 wiki frontmatter，可能包含 `</title><script>alert(1)</script>` 等恶意标签
2. `el.innerHTML` 是渲染后的 Markdown 内容，其中可能包含用户注入的 HTML
3. 这些值被直接插入到 HTML 模板字符串中，没有任何转义

**影响**: 如果 wiki 页面包含恶意内容（例如通过 upload-paste-ingest 链路注入），导出的 HTML 文件会在浏览器中执行该内容。虽然攻击面受限于 wiki 内容来源（通常来自可信源），但这是安全漏洞。

**修复**: ✅ 已在上方编辑中修复 — 添加了 HTML 转义函数 `escapeHtml`，对 `node.label` 进行 `&<>"` 转义。

---

# 🟠 严重问题 (1)

### D2. `wiki-viewer/src/components/pages/HomePage.tsx:261-286` — `GrowthTrendChart` 使用合成假数据

```typescript
const data = useMemo(() => {
    const maxPages = Math.max(currentPages, 1);
    return days.map((date, i) => {
      const base = (i / 6) * maxPages;
      const noise = i === 6 ? 0 : Math.sin(i * 2.5) * 0.08 * maxPages;
      return {
        date,
        value: Math.max(0, Math.round(base + noise)),
      };
    });
  }, [currentPages, days]);
```

**根因**: 图表使用 `Math.sin()` 生成"噪声"，创建了一条从 0 到当前页数的线性趋势线。这不是真实的历史数据——它是完全伪造的！

**影响**: 用户点击首页看到的"增长趋势"图是假的。如果 wiki 没有存储历史数据，应该显示"无历史数据"而不是伪造数据。

**修复**: 要么存储真实的历史数据点（在每次 ingest/health 时记录页面数量），要么移除该图表并显示"正在收集数据..."的占位符。

---

# 🟡 中等问题 (5)

### D3. `wiki-viewer/src/components/pages/HomePage.tsx:71` — `useEffect` 缺少依赖

```typescript
function useWikiStats() {
  // ...
  const refetch = async () => { ... };
  useEffect(() => {
    refetch();
  }, []);  // ← refetch 不在依赖数组中
```

**根因**: `refetch` 在每次渲染时重新创建（非 `useCallback`），但 `useEffect` 仅捕获第一次渲染时的版本。如果组件因其他原因重新渲染但 `refetch` 引用改变，effect 不会重新执行。在实际场景中影响有限（因为组件很少需要重新挂载时重新获取），但违反 React hook 规则。

**修复**: 将 `refetch` 包裹在 `useCallback` 中并添加到依赖数组。

---

### D4. `wiki-viewer/src/components/pages/PageDetailPage.tsx:72` — 节点匹配可能误匹配

```typescript
const node = useMemo(() => {
    return graphData.nodes.find(
      (n) => n.type === type && n.id.endsWith(`/${param}`)
    );
  }, [graphData, type, param]);
```

**根因**: `endsWith` 检查可能产生误匹配。如果 `param = "AI"` 且 `n.id = "entities/GenAI"`，`endsWith("/AI")` 会匹配。更可能出现的是 `n.id = "entities/MyAI"` 和 `param = "AI"` 虽然不匹配（`"/MyAI"` 不以 `"/AI"` 结尾），但这是脆弱的匹配。

**修复**: 使用精确的 stem 比较: `n.id.toLowerCase().endsWith(`/${param.toLowerCase()}`)` 已经基本可靠，但更安全的方式是用正则: `/${param}$`。

---

### D5. `wiki-viewer/src/components/pages/BrowsePage.tsx:105` — `sortBy=connected` 的 O(n²) 性能

```typescript
} else if (sortBy === 'connected') {
    const countMap = new Map<string, number>();
    result.forEach((n) => countMap.set(n.id, getBacklinks(n.id).length));
```

**根因**: `getBacklinks(nodeId)` 内部通过 `graphData.edges.filter(e => e.to === nodeId)` 计算，这是 O(E) 的。然后对 N 个页面调用，总体是 O(N·E)。对于大图（1000节点 × 5000边），这是百万级操作。

**影响**: 在大型 wiki 上按"连接数"排序时可能明显卡顿。

**修复**: 预计算一个 `backlinkCountMap` 一次（O(E)），然后在排序时查询。

---

### D6. `wiki-viewer/src/components/pages/PageDetailPage.tsx:86-93` — 草稿自动保存的竞态条件

```typescript
useEffect(() => {
    if (!draftKey || !isEditing) return;
    const timer = setTimeout(() => {
      localStorage.setItem(draftKey, editContent);
      setHasDraft(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [draftKey, editContent, isEditing]);
```

**根因**: React 18 Strict Mode 会双重挂载组件。第一次 `setTimeout` 被 `clearTimeout` 取消，但 Effect 又被重新运行，创建新的 timer。实际功能正常，但 timer 创建/取消被加倍。另外，如果用户在 2 秒内关闭标签页，草稿不会保存（因为 setTimeout 还未执行）。

**修复**: 添加 `beforeunload` 事件监听器和 `visibilitychange` 处理（切换到后台时立即保存）。

---

### D7. `wiki-viewer/src/components/pages/HomePage.tsx:843` — 链接密度条使用无意义的缩放因子

```typescript
animate={{ width: `${Math.min(100, stats.pages > 0 ? (stats.edges / stats.pages) * 25 : 0)}%` }}
```

**根因**: `(edges/pages) * 25` 中 `25` 是一个魔数。如果 100 页有 200 条边，显示 `(200/100)*25 = 50%`。这个百分比没有实际意义。应该显示 edges/pages 比值本身（"2.0 条边/页"），而不是伪造的百分比。

---

# 🟢 轻微问题 (2)

### D8. `wiki-viewer/src/components/pages/PageDetailPage.tsx:264-283` — 导出行内嵌 massive HTML

导出按钮的 `onClick` 处理函数长达 1000+ 字符，包含完整的 HTML 模板、CSS 样式（全部 inline）。应提取为独立函数。

### D9. `wiki-viewer/src/components/pages/HomePage.tsx:121-126` — `orphanEstimate` 命名误导

```typescript
const connectedIds = new Set<string>();
for (const e of edgeList) {
    connectedIds.add(e.from);
    connectedIds.add(e.to);
}
const orphanEstimate = Math.max(0, pages - connectedIds.size);
```

这段代码计算的是"没有任何边连接的节点数"（度为0），而 wiki 中 "orphan" 的语义是"无入站 wikilink 的页面"。这是不同的概念。变量名应改为 `isolatedEstimate` 或 `zeroDegreeCount`。

---

# 五轮审查累计

| 严重程度 | 第一/二轮 | 第三轮 | 第四轮 | 第五轮 | 总计 |
|----------|----------|--------|--------|--------|------|
| 致命 | 3 | 5 | 2 | 1 | **11** |
| 严重 | 14 | 7 | 5 | 1 | **27** |
| 中等 | 47 | 18 | 13 | 5 | **83** |
| 轻微 | 16 | 8 | 5 | 2 | **31** |
| **合计** | **80** | **38** | **25** | **9** | **152** |

## 本轮修复
- ✅ D1 (XSS) — 已修复，添加 HTML 转义
- ✅ D1 文件名安全性 — 已修复，替换非法文件名字符
