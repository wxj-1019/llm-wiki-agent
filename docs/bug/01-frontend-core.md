# LLM Wiki Agent — 前端核心逻辑 Bug 报告

> 审查日期：2026-05-04 | 审查范围：stores、services、hooks、lib 工具函数 | 共 13 个文件

---

## P0 — 严重 Bug（影响核心功能、数据安全或导致崩溃）

### FE-CORE-001: useChat.ts — handleSendChat 闭包捕获过时 chatMessages

- **文件**: `wiki-viewer/src/hooks/useChat.ts`
- **行号**: L43, L46, L142
- **描述**: `handleSendChat` 的 `useCallback` 依赖数组包含 `chatMessages`（第 142 行），每次消息列表变化时回调都会重建。但 L46 处 `const newMessages = [...chatMessages, userMsg]` 读取的是闭包中的 `chatMessages`，如果用户在 streaming 期间再次发送消息，或者在其他地方调用 `setChatMessages`，可能读取到过时的消息状态。L104 的流式处理中使用了函数式更新 `setChatMessages((prev) => ...)`，但 L46 的 `newMessages` 仍然是基于闭包的旧值。
- **影响**: AI 回复可能基于错误的历史上下文，消息顺序可能错乱
- **建议修复**: 将消息的追加逻辑统一使用函数式 `setChatMessages` 更新，或者使用 `useRef` 维护最新的消息列表引用

### FE-CORE-002: configStore.ts — setConfig 浅合并覆盖嵌套配置

- **文件**: `wiki-viewer/src/stores/configStore.ts`
- **行号**: L84-88
- **描述**: `setConfig` 使用 `{ ...get().config, ...partial }` 进行浅合并。如果传入 `{ github: { token: 'new' } }`，它会完全覆盖整个 `github` 对象（包括 `trending` 子对象），丢失 `trending` 配置。同理 `loadFromServer` 中 L173 的 `{ ...get().config, ...parsed }` 也有同样问题。
- **影响**: 调用 `setConfig` 后 github.trending 等嵌套配置丢失，功能异常
- **建议修复**: 使用深度合并（deep merge）代替浅合并，或确保每个 `set*` 方法只修改对应的嵌套路径

### FE-CORE-003: configStore.ts — loadFromServer 绕过 safeSet 直接写 localStorage

- **文件**: `wiki-viewer/src/stores/configStore.ts`
- **行号**: L192
- **描述**: `localStorage.setItem('wiki-system-config', JSON.stringify(get().config))` 绕过了 `safeSet` 封装，如果 localStorage 已满或被禁用，会抛出未捕获的异常导致整个 `loadFromServer` 函数失败。
- **影响**: localStorage 满时整个配置加载流程崩溃
- **建议修复**: 将 `localStorage.setItem(...)` 替换为 `safeSet('wiki-system-config', get().config)`

### FE-CORE-004: wikiStore.ts — 图缓存反序列化缺少类型校验

- **文件**: `wiki-viewer/src/stores/wikiStore.ts`
- **行号**: L47-52
- **描述**: `loadGraphCache` 使用 `safeGet(GRAPH_CACHE_KEY, isObject, null)` 进行校验，但 `isObject` 只验证值是一个非 null 非 array 的对象。缓存中的 `data` 字段（L51 `parsed.data as GraphData`）没有进行任何结构验证。如果缓存数据被损坏或格式不匹配（例如缺少 `nodes`/`edges` 字段），后续代码会在 `initSearch(data.nodes)` 处抛出运行时错误。
- **影响**: 损坏的缓存导致应用白屏崩溃
- **建议修复**: 添加对缓存数据的结构验证，至少检查 `data.nodes` 是数组且 `data.edges` 是数组

### FE-CORE-005: notificationStore.ts — setTimeout 无清理导致内存泄漏

- **文件**: `wiki-viewer/src/stores/notificationStore.ts`
- **行号**: L47-51
- **描述**: `addNotification` 内部创建的 `setTimeout` 没有被追踪或清理。如果组件频繁触发通知（例如流式错误场景），会累积大量定时器。更关键的是，如果 store 在 SSR 或测试环境中使用，这些定时器不会被清理。
- **影响**: 快速操作时定时器累积，测试环境潜在问题
- **建议修复**: 维护一个定时器 ID 集合，在 `clearNotifications` 和 `dismissToast` 中清理对应定时器

---

## P1 — 高优先级 Bug

### FE-CORE-006: useChat.ts — 流式期间每个 chunk 都触发 localStorage 写入

- **文件**: `wiki-viewer/src/hooks/useChat.ts`
- **行号**: L33-35
- **描述**: 流式响应期间，`chatMessages` 每接收一个 chunk 就更新一次（L121-126），触发 `useEffect` 将整个消息历史序列化写入 localStorage。如果消息较长（5000+ tokens），每秒可能触发数十次 `JSON.stringify` + `localStorage.setItem`，造成明显的 UI 卡顿。
- **影响**: 聊天时 UI 卡顿，尤其在长回复时明显
- **建议修复**: 对持久化操作进行 debounce（类似于 `wikiStore` 中的 `schedulePersist` 模式），或者只在流式完成后写入

### FE-CORE-007: useChat.ts — handleQuickPrompt 清空聊天历史

- **文件**: `wiki-viewer/src/hooks/useChat.ts`
- **行号**: L171-174
- **描述**: `handleQuickPrompt` 在 L171 用 `setChatMessages([userMsg, assistantMsg])` 完全替换了聊天历史，导致用户之前的对话上下文丢失。如果用户正在进行对话然后点击 quick prompt，之前的所有消息都会被清空。
- **影响**: 用户丢失对话历史
- **建议修复**: 如果意图是追加消息，应该用 `[...prev, userMsg, assistantMsg]`；如果意图是新建对话，应该在 UI 上给出明确提示

### FE-CORE-008: useChat.ts — handleQuickPrompt 缺少 StreamDeduplicator

- **文件**: `wiki-viewer/src/hooks/useChat.ts`
- **行号**: L191-194
- **描述**: `handleQuickPrompt` 中 L193 `if (part.chunk === lastChunk) continue;` 只跳过与前一个完全相同的 chunk，但不处理累积式文本。而在 `handleSendChat`（L106-128）中使用了 `StreamDeduplicator`。两个代码路径对相同的数据流使用了不同的去重策略。
- **影响**: Quick prompt 路径的流式输出可能包含重复内容
- **建议修复**: 在 `handleQuickPrompt` 中也使用 `StreamDeduplicator`，与 `handleSendChat` 保持一致

### FE-CORE-009: streamUtils.ts — StreamDeduplicator 累积文本检测逻辑有漏洞

- **文件**: `wiki-viewer/src/lib/streamUtils.ts`
- **行号**: L27-41
- **描述**: L33-37 的条件中 `previous && this.fullText.startsWith(previous) && chunk.startsWith(this.fullText)` 只在 `previous` 是 `fullText` 的前缀时才成立。如果 provider 发送的是累积式文本且偶尔跳过一个 chunk，`fullText` 就会包含重复内容。
- **影响**: 某些 LLM provider 的流式输出可能出现内容重复
- **建议修复**: 添加更健壮的检测逻辑，比较 chunk 与 fullText 的重叠部分

### FE-CORE-010: wikiStore.ts — initialize 没有防止并发调用

- **文件**: `wiki-viewer/src/stores/wikiStore.ts`
- **行号**: L92-122
- **描述**: `initialize` 方法在 L94 检查 `if (graphData) return;`，但如果两个组件同时调用 `initialize`，在第一个请求完成之前 `graphData` 仍然是 `null`，第二个请求也会进入加载逻辑，导致重复的 API 调用和 `initSearch` 调用。
- **影响**: 重复的 API 请求和搜索索引初始化
- **建议修复**: 添加一个 `initializing` promise 引用，确保并发调用共享同一个 Promise

### FE-CORE-011: wikiStore.ts — readingProgress 无限增长

- **文件**: `wiki-viewer/src/stores/wikiStore.ts`
- **行号**: L188-194, L77
- **描述**: `readingProgress` 是一个 `Record<string, number>`，每次用户阅读新页面都会添加新条目，但从不清理。长期使用后，这个对象会包含数百甚至数千个条目，每次持久化都要序列化整个对象。
- **影响**: 长期使用后 localStorage 存储膨胀
- **建议修复**: 添加 LRU 淘汰机制，只保留最近 100 个页面的阅读进度

---

## P2 — 中等优先级

### FE-CORE-012: search.ts — searchContent 每次调用都创建新的 Fuse 实例

- **文件**: `wiki-viewer/src/lib/search.ts`
- **行号**: L33-61
- **描述**: `searchContent` 每次被调用都会创建一个新的 `Fuse` 实例，如果节点数量多且用户频繁搜索，会造成性能问题。
- **建议修复**: 缓存 `contentFuse` 实例，或在 `initSearch` 时同时构建内容搜索索引

### FE-CORE-013: search.ts — frontmatter 剥离逻辑不健壮

- **文件**: `wiki-viewer/src/lib/search.ts`
- **行号**: L44-49
- **描述**: `getFn` 中假设 frontmatter 以 `---` 开头。但如果 markdown 内容以空行开头，frontmatter 不会被剥离。另外如果正文内容中包含 `---`（水平分割线），会错误截断。
- **建议修复**: 使用更健壮的 frontmatter 解析：`/^---\n[\s\S]*?\n---\n/`

### FE-CORE-014: chatService.ts — SSE 解析器不处理多行 data 字段

- **文件**: `wiki-viewer/src/services/chatService.ts`
- **行号**: L45-69
- **描述**: SSE 协议允许 `data:` 字段跨多行。当前实现只检查 `trimmed.startsWith('data: ')`，不处理多行 data 的情况。
- **建议修复**: 使用更健壮的 SSE 解析器

### FE-CORE-015: chatService.ts — 缓冲区未处理数据在流结束时丢失

- **文件**: `wiki-viewer/src/services/chatService.ts`
- **行号**: L41-71
- **描述**: 当流结束时，如果 `buffer` 中仍有未处理的数据（不完整的 SSE 事件），这些数据会被静默丢弃。
- **建议修复**: 在 `while` 循环结束后，检查 `buffer` 是否仍有内容

### FE-CORE-016: validation.ts — sanitizePath 可能产生空路径

- **文件**: `wiki-viewer/src/lib/validation.ts`
- **行号**: L24-30
- **描述**: `sanitizePath` 移除 `..`、null bytes 和特殊字符后，如果原始路径只包含这些字符，结果会是空字符串。
- **建议修复**: 检查结果是否为空字符串，返回安全默认值或抛出错误

### FE-CORE-017: validation.ts — PATH_TRAVERSAL_PATTERN 不匹配编码后的路径

- **文件**: `wiki-viewer/src/lib/validation.ts`
- **行号**: L5-14
- **描述**: 只匹配字面的 `../` 和 `..\`，但不匹配 URL 编码的变体如 `%2e%2e%2f`、`..%2f`。
- **建议修复**: 先对路径进行 URL 解码，然后再进行验证

### FE-CORE-018: configStore.ts — loadFromStorage 浅合并导致默认值丢失

- **文件**: `wiki-viewer/src/stores/configStore.ts`
- **行号**: L61-64
- **描述**: `{ ...DEFAULT_CONFIG, ...stored }` 浅合并时，如果 `stored` 包含一个不完整的 `github` 对象，会完全覆盖默认的 `github` 配置。
- **建议修复**: 对每个顶级字段进行独立的深度合并

---

## P3 — 低优先级

### FE-CORE-019: router.tsx — 每个子路由重复指定 errorElement

- **文件**: `wiki-viewer/src/router.tsx`
- **行号**: L37-58
- **描述**: 根级路由已指定 `errorElement: <ErrorBoundary />`，子路由重复指定是冗余的。
- **建议修复**: 移除子路由上的 `errorElement`

### FE-CORE-020: main.tsx — document.getElementById 非空断言

- **文件**: `wiki-viewer/src/main.tsx`
- **行号**: L15
- **描述**: `document.getElementById('root')!` 如果 HTML 中缺少 `<div id="root">`，错误信息不友好。
- **建议修复**: 添加显式 null 检查

### FE-CORE-021: dateUtils.ts — 异常时返回空字符串

- **文件**: `wiki-viewer/src/lib/dateUtils.ts`
- **行号**: L3-8
- **描述**: `formatDistanceToNow` 在异常时返回空字符串，UI 上会显示空白。
- **建议修复**: 返回降级文本如 `'未知时间'`

### FE-CORE-022: wikiStore.ts — persistNow 手动调用模式不一致

- **文件**: `wiki-viewer/src/stores/wikiStore.ts`
- **行号**: L138-184
- **描述**: `toggleSidebar`、`setTheme`、`addRecentPage`、`toggleFavorite` 都手动调用 `persistNow(get())`，模式不一致。
- **建议修复**: 统一使用 `subscribe` 监听持久化
