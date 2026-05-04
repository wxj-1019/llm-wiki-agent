# LLM Wiki Agent — 前端页面组件 Bug 报告

> 审查日期：2026-05-04 | 审查范围：18 个组件文件 | 共发现 51 个问题

---

## P0 — 严重 Bug

### FE-PAGE-001: ChatPage.tsx — doSend 闭包捕获过时 entries

- **文件**: `wiki-viewer/src/components/pages/ChatPage.tsx`
- **行号**: L196
- **描述**: `doSend` 使用了 `const currentEntries = entries`，但 `entries` 来自组件上层的闭包。在流式传输过程中 `setEntries` 多次调用导致 `entries` 引用不断变化，可能产生竞态：history 构建基于的 entries 快照可能已经过时。
- **影响**: AI 回复可能基于错误的上下文
- **建议修复**: 在 `doSend` 内部通过 ref 获取最新的 entries，或使用 `setEntries` 的函数形式来推导 history

### FE-PAGE-002: ChatPage.tsx — 自动发送 context 的 useEffect 存在竞态

- **文件**: `wiki-viewer/src/components/pages/ChatPage.tsx`
- **行号**: L175-184
- **描述**: `useEffect` 依赖数组为空 `[]`，但内部调用了 `setEntries` 和 `doSend`。`doSend` 没有在依赖数组中（被 eslint-disable 压制），当 effect 首次执行时 `doSend` 可能还未绑定到正确的闭包。同时，如果 localStorage 中有上次会话的消息，context 自动发送会被跳过。
- **影响**: 页面上下文可能不会被自动发送给 AI
- **建议修复**: 使用 `useRef` 标记是否已处理过 context

### FE-PAGE-003: GraphPage.tsx — vis-network 直接操作内部 API

- **文件**: `wiki-viewer/src/components/pages/GraphPage.tsx`
- **行号**: L173, L180
- **描述**: 直接访问 `networkRef.current.body.data.nodes.update()` 和 `.edges.update()`，这是 vis-network 的内部 API（非公开）。如果 vis-network 版本升级，这些内部属性可能被重命名或移除，导致运行时崩溃。
- **影响**: vis-network 升级后应用崩溃
- **建议修复**: 维护对 DataSet 的引用通过公开 API 操作

### FE-PAGE-004: MarkdownRenderer.tsx — dangerouslySetInnerHTML 存在 XSS 风险

- **文件**: `wiki-viewer/src/components/content/MarkdownRenderer.tsx`
- **行号**: L89
- **描述**: shiki 生成的 HTML 通过 `dangerouslySetInnerHTML` 直接注入。虽然 shiki 会转义 `<` 和 `>`，但依赖 shiki 的实现正确性。如果代码内容包含精心构造的字符串，可能存在 XSS 风险。
- **影响**: 潜在 XSS 攻击面
- **建议修复**: 对 shiki 输出做一次额外的 sanitizer 处理（如 DOMPurify）

---

## P1 — 高优先级 Bug

### FE-PAGE-005: HomePage.tsx — 搜索结果 selectedIdx 越界

- **行号**: L171-178
- **描述**: 当 `homeResults` 因 debounce 更新而缩短时，`selectedIdx` 可能大于新的结果长度。
- **建议修复**: 在 `debouncedHomeQuery` 变化时自动重置 `selectedIdx` 为 `-1`

### FE-PAGE-006: HomePage.tsx — randomNode 使用 useState + useEffect 造成闪烁

- **行号**: L55-61
- **描述**: 首次渲染时 `randomNode` 为 null，effect 触发后才显示，造成内容闪烁。
- **建议修复**: 使用 `useMemo` 替代 `useState + useEffect`

### FE-PAGE-007: HomePage.tsx — copied 状态 setTimeout 无清理

- **行号**: L136
- **描述**: `setTimeout(() => setCopied(false), 2000)` 没有保存 timer 引用。
- **建议修复**: 使用 `useRef` 保存 timer，在 cleanup 中清除

### FE-PAGE-008: BrowsePage.tsx — filterType 与 URL 参数可能不同步

- **行号**: L30-41
- **描述**: `initialType` 从 URL 参数读取，但 `useState(initialType)` 只在首次渲染生效。URL 参数变化时 `filterType` 不会同步更新。
- **建议修复**: 将 `useEffect` 的依赖改为 `initialType`，或直接使用 `initialType` 作为 source of truth

### FE-PAGE-009: PageDetailPage.tsx — parseFrontmatter 和 getBacklinks 在渲染函数中调用

- **行号**: L61-62
- **描述**: 每次渲染都重新计算 `parseFrontmatter` 和 `getBacklinks`。当 `readingProgress` 频繁更新触发重渲染时，这些计算会不必要地重复执行。
- **建议修复**: 将结果包裹在 `useMemo` 中

### FE-PAGE-010: PageDetailPage.tsx — 收藏按钮通知消息逻辑反转风险

- **行号**: L175-182
- **描述**: `toggleFavorite` 是异步状态更新，调用后立即读取 `isFavorite(node.id)` 获取的仍然是旧值。当前"恰好正确"但模式脆弱。
- **建议修复**: 基于当前值取反来决定通知文本：`const willBeFavorite = !isFavorite(node.id)`

### FE-PAGE-011: SearchPage.tsx — initialQuery 变化时覆盖用户输入

- **行号**: L43-56
- **描述**: 如果用户正在输入，此时 URL 参数变了（如从其他组件导航过来），用户的输入会被覆盖。
- **建议修复**: 只在组件首次挂载时从 URL 读取，或添加"用户是否手动编辑过"的 ref

### FE-PAGE-012: ChatPage.tsx — 消息列表使用数组索引作为 key

- **行号**: L459
- **描述**: `<motion.div key={i}>` 使用数组索引作为 key。`handleRegenerate` 后 React 可能错误地复用旧 DOM 节点。
- **建议修复**: 为每个 `ChatEntry` 添加唯一 `id` 字段

### FE-PAGE-013: ChatPage.tsx — 删除会话后 activeId 可能指向已删除的会话

- **行号**: L304-318
- **描述**: 快速连续删除多个会话时，`activeId` 可能指向已删除会话。
- **建议修复**: 在 `setSessions` 的回调函数内部同时处理 `activeId` 的更新

### FE-PAGE-014: MCPPage.tsx — 轮询间隔 3 秒过于频繁

- **行号**: L45-46
- **描述**: 每 3 秒轮询一次 MCP 服务器状态，没有使用 `document.visibilityState` 来暂停轮询。
- **建议修复**: 添加 visibility change 监听，页面不可见时暂停轮询

### FE-PAGE-015: MCPPage.tsx — loading 状态是全局的

- **行号**: L27, L49-65
- **描述**: 所有操作共享同一个 `loading` 状态。操作 server A 时无法对 server B 做任何操作。
- **建议修复**: 使用 `Set<string>` 追踪正在操作的服务器名称

### FE-PAGE-016: SettingsPage.tsx — handleSave 中 setTimeout 无清理

- **行号**: L62, L101
- **描述**: 两处 `setTimeout` 均无清理。
- **建议修复**: 保存 timer 引用并在 cleanup 中清除

### FE-PAGE-017: SettingsPage.tsx — LLM 配置获取错误被静默吞掉

- **行号**: L39-51
- **描述**: `.catch(() => {})` 完全吞掉了错误。用户看到的表单会是默认值，没有任何提示。
- **建议修复**: 在 catch 中设置提示状态

### FE-PAGE-018: MarkdownRenderer.tsx — aComponent 在 onSourceClick 变化时重建

- **行号**: L214-218
- **描述**: `useMemo` 包裹的组件在 `onSourceClick` 变化时重新创建组件定义，导致所有链接节点重新渲染。
- **建议修复**: 将 `onSourceClick` 存入 ref，在组件内读取 ref.current

### FE-PAGE-019: MarkdownRenderer.tsx — CodeBlock 中 useTranslation 位置有风险

- **行号**: L64
- **描述**: `useTranslation()` 在条件返回之后调用，增加了维护风险。如果未来重构将条件返回提前，会违反 hooks 规则。
- **建议修复**: 将 `const { t } = useTranslation()` 移到组件函数的顶部

### FE-PAGE-020: MarkdownRenderer.tsx — processWikiLinks 对嵌套结构处理不完整

- **行号**: L94-120
- **描述**: 如果 children 是 React 元素（非字符串、非数组），函数直接返回而不处理其 props.children。
- **建议修复**: 在递归分支中处理 React 元素的 `props.children`

---

## P2 — 中等优先级

### FE-PAGE-021: HomePage.tsx — sources/entities/concepts 每次渲染都重新 filter

- **行号**: L45-48
- **建议修复**: 将这些计算移入 `useMemo`

### FE-PAGE-022: HomePage.tsx — recentNodes 未 memoize

- **行号**: L50-53
- **建议修复**: 包裹在 `useMemo` 中

### FE-PAGE-023: BrowsePage.tsx — getBacklinks 作为 useMemo 依赖导致不必要的重计算

- **行号**: L46, L69
- **描述**: `sortBy === 'connected'` 分支对每个节点调用 `getBacklinks`，复杂度为 O(n*m)。
- **建议修复**: 预计算所有节点的 backlinks count

### FE-PAGE-024: GraphPage.tsx — nodes/edges 未使用 useMemo

- **行号**: L57-L60
- **描述**: `graphData` 为 `null` 时每次渲染都会创建新的空数组引用。
- **建议修复**: 使用 `useMemo` 包裹

### FE-PAGE-025: GraphPage.tsx — vis-network 重建时未考虑 filterTypes

- **行号**: L71-158
- **描述**: 主 effect 创建 network 时应用了 `filterTypes`，但依赖数组中不包含 `filterTypes`。
- **建议修复**: 在第二个 effect 中添加对 `networkRef.current` 是否已初始化的检查

### FE-PAGE-026: GraphPage.tsx — GraphStats 密度计算公式可能有误

- **行号**: L410
- **描述**: 计算的是有向图密度。如果意图是无向图密度，应除以 `2 * nodeCount * (nodeCount - 1)`。
- **建议修复**: 确认图的类型并调整公式

### FE-PAGE-027: SearchPage.tsx — 搜索结果未限制数量

- **行号**: L47-50
- **描述**: 返回所有匹配结果，当 wiki 很大时可能导致 DOM 节点过多。
- **建议修复**: 添加 `.slice(0, 50)` 限制

### FE-PAGE-028: ChatPage.tsx — 会话持久化校验过于宽松

- **行号**: L44-56
- **描述**: `isValidSessions` 没有验证数组内每个 session 的结构。
- **建议修复**: 添加更严格的运行时类型验证

### FE-PAGE-029: ChatPage.tsx — handleCopy 中 setTimeout 无清理

- **行号**: L330
- **建议修复**: 使用 ref 追踪所有活跃的 timer

### FE-PAGE-030: SkillsPage.tsx — 无轮询但状态可能过时

- **行号**: L37-39
- **建议修复**: 添加定时轮询或 WebSocket 推送更新

### FE-PAGE-031: UploadPage.tsx — handleBatchIngest 未充分处理失败

- **行号**: L221-L226
- **描述**: 批量 ingest 失败时循环继续但未告知哪些文件失败。
- **建议修复**: 收集失败的文件列表

### FE-PAGE-032: UploadPage.tsx — "已摄入" 统计不准确

- **行号**: L298
- **描述**: 将所有 `.md` 文件计为"已摄入"，但放入 `raw/` 后不一定已被 ingest。
- **建议修复**: 后端返回每个文件的 ingest 状态

### FE-PAGE-033: LogPage.tsx — parseLog 返回的 entries 排序可能不符合预期

- **行号**: L201-L214
- **描述**: 最新条目可能不在顶部。
- **建议修复**: 确认 `log.md` 的写入顺序并调整排序

### FE-PAGE-034: StatusPage.tsx — fetchStatus 非 useCallback

- **行号**: L33-L46
- **建议修复**: 使用 `useCallback` 包裹

### FE-PAGE-035: WikiLink.tsx — pipe 处理逻辑冗余

- **行号**: L17-L18
- **描述**: `processWikiLinks` 已解析了 `[[Target|Display]]`，`WikiLink` 再次处理 pipe 是冗余的。
- **建议修复**: 移除冗余逻辑或添加注释说明

### FE-PAGE-036: CommandPalette.tsx — selectedIndex 可能指向 separator 项

- **行号**: L154-L168
- **描述**: 上下键导航时可能高亮一个 separator 项。
- **建议修复**: 在导航时跳过 separator 项

### FE-PAGE-037: CommandPalette.tsx — selectedIndex 重置依赖不正确

- **行号**: L150-L152
- **描述**: 只在结果数量变化时重置。查询变化但结果数量不变时不会重置。
- **建议修复**: 依赖改为 `[allCommands]`

### FE-PAGE-038: Header.tsx — debounce timer 无清理

- **行号**: L59-L66
- **建议修复**: 添加 cleanup effect

### FE-PAGE-039: RootLayout.tsx — 离线横幅 z-index 与 Header 冲突

- **行号**: L40-45
- **建议修复**: 将离线横幅 z-index 改为 `z-[45]`

---

## P3 — 低优先级

### FE-PAGE-040: HomePage.tsx — 搜索输入框 role="search" 使用不当

- **行号**: L165
- **描述**: `role="search"` 应该用在容器元素上，而不是 `<input>` 元素。
- **建议修复**: 将 `role="search"` 移到外层 `<div>` 上

### FE-PAGE-041: BrowsePage.tsx — animationDelay 无对应 CSS animation

- **行号**: L167
- **描述**: `useMotion` 为 false 时使用 `style={{ animationDelay }}` 但无对应 CSS animation。
- **建议修复**: 移除无效的 `animationDelay`

### FE-PAGE-042: PageDetailPage.tsx — 404 页面使用 emoji

- **行号**: L120
- **建议修复**: 替换为 lucide-react 图标保持一致

### FE-PAGE-043: PageDetailPage.tsx — typeColors 所有类型使用相同颜色

- **行号**: L31-36
- **描述**: 与 `BrowsePage` 中每种类型有不同颜色不一致。
- **建议修复**: 为每种类型分配不同的颜色

### FE-PAGE-044: GraphPage.tsx — onboard overlay 点击穿透

- **行号**: L293
- **描述**: onboard overlay 背景层 `onClick` 关闭 onboard，但点击事件可能穿透到下层 graph canvas。
- **建议修复**: 在 overlay 的 `onClick` 中调用 `e.stopPropagation()`

### FE-PAGE-045: MCPPage.tsx — 使用 alert() 显示提示

- **行号**: L87
- **建议修复**: 替换为 `addNotification`

### FE-PAGE-046: MCPPage/SkillsPage — action 函数不是 useCallback

- **行号**: L49-66
- **建议修复**: 使用 `useCallback` 包裹

### FE-PAGE-047: UploadPage.tsx — toggleSelectAll 逻辑可能不准确

- **行号**: L241-L247
- **建议修复**: 改为检查 filteredFiles 中的所有文件是否都被选中

### FE-PAGE-048: MarkdownRenderer.tsx — processWikiLinks 嵌套处理不完整

- **行号**: L94-120
- **建议修复**: 处理 React 元素的 `props.children`

### FE-PAGE-049: Sidebar.tsx — 移动端侧边栏关闭动画期间仍可交互

- **行号**: L152-174
- **建议修复**: 在退出动画开始时添加 `pointer-events-none`

### FE-PAGE-050: Header.tsx — 搜索下拉框无 AnimatePresence

- **行号**: L120-L163
- **建议修复**: 添加 `AnimatePresence` 和 `motion.div` 包裹

### FE-PAGE-051: RootLayout.tsx — 离线横幅遮挡主内容

- **行号**: L46, L53
- **描述**: 离线横幅显示时主内容区域没有额外的 padding-top 来补偿。
- **建议修复**: 当 `!isOnline` 时添加额外的 `pt-9`
