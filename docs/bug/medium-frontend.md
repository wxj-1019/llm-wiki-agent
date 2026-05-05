# Medium Severity Bugs — Frontend

## React / TypeScript / State Management

### MF1: `main.tsx:14-16` — Service Worker 更新间隔重复设置且永不清理

- **文件**: `wiki-viewer/src/main.tsx`
- **行号**: 14-16
- **严重程度**: **MEDIUM**

**问题描述**:
```typescript
setInterval(() => registration.update(), 60 * 60 * 1000);
```
这个 `setInterval` 永不清理。此外 `useSWUpdate.ts:19-23` 设置了另外一个30分钟间隔做同样的事，导致重复检查。

**修复建议**:
移除 `main.tsx` 中的 `setInterval`（`useSWUpdate` hook已有周期性更新且带清理），或保存interval ID并在 `beforeunload` 时清除。

---

### MF2: `dataService.ts:37` — `fetchGraphData` 降级请求没有超时

- **文件**: `wiki-viewer/src/services/dataService.ts`
- **行号**: 37
- **严重程度**: **MEDIUM**

**问题描述**:
```typescript
const res = await fetch(`${import.meta.env.BASE_URL}data/graph.json`);
```
当API服务器不可用时，降级的 `fetch` 调用没有超时和 `AbortController`。如果静态文件服务器挂起，请求无限期阻塞。

**修复建议**:
使用 `fetchWithTimeout` 包装:
```typescript
const res = await fetchWithTimeout(`${import.meta.env.BASE_URL}data/graph.json`, { timeoutMs: 10000 });
```

---

### MF3: `wikiStore.ts:142-150` — 后台刷新不更新 `_lastEtag`

- **文件**: `wiki-viewer/src/stores/wikiStore.ts`
- **行号**: 142-150
- **严重程度**: **MEDIUM**

**问题描述**:
从缓存加载图数据后，后台刷新更新了 `graphData` 和缓存，但从未将 `_lastEtag` 设置为当前服务器etag。`_lastEtag` 保持为 `'0'`，导致第一次轮询正确跳过（因为条件 `_lastEtag !== '0'` 为false），但第二次轮询会触发不必要的数据刷新。

**修复建议**:
后台刷新成功后获取并缓存etag:
```typescript
const etag = await fetchIndexEtag();
if (etag !== '0') _lastEtag = etag;
```

---

### MF4: `SearchPage.tsx:60-68` — `hybridSearch` 捕获过期的节点数据

- **文件**: `wiki-viewer/src/components/pages/SearchPage.tsx`
- **行号**: 60-68
- **严重程度**: **MEDIUM**

**问题描述**:
`hybridSearch(debouncedQuery, getAllNodes(), semantic)` 在 `contentFuse` 已经创建后使用模块级 `allNodes`。如果后台轮询在搜索会话期间刷新了图数据，Fuse.js索引持有过期的节点数据用于FTS降级路径。

**修复建议**:
显式传递 `nodes` 参数，在节点集变化时重建 `contentFuse`。

---

### MF5: `RootLayout.tsx:74` — Banner堆叠不计算多个banner所需的空间

- **文件**: `wiki-viewer/src/components/layout/RootLayout.tsx`
- **行号**: 74
- **严重程度**: **MEDIUM**

**问题描述**:
```typescript
className={... ${!isOnline || updateAvailable || canInstall ? 'pt-[6.5rem]' : 'pt-14'}}
```
如果用户既离线又有PWA更新可用，会渲染两个banner，但 `pt` 只添加了一个banner的空间。第二个banner会与内容重叠。

**修复建议**:
根据可见banner数量动态计算padding-top:
```typescript
const bannerCount = [!isOnline, updateAvailable, canInstall].filter(Boolean).length;
const ptClass = bannerCount > 0 ? `pt-[${3.5 + bannerCount * 2.5}rem]` : 'pt-14';
```

---

### MF6: `useChat.ts:54-55` — `handleSendChat` 存在双重发送竞态

- **文件**: `wiki-viewer/src/hooks/useChat.ts`
- **行号**: 54-55
- **严重程度**: **MEDIUM**

**问题描述**:
```typescript
const chatLoadingRef = useRef(false);
// ...
if (!content.trim() || chatLoadingRef.current) return;
```
`chatLoadingRef.current` 初始化为 `false`，但在第59行 `setChatLoading(true)` 之前不会设为 `true`。如果用户在同一同步tick内双击发送按钮，两次调用都通过守卫，创建两个并发流式会话。

**修复建议**:
将ref赋值移到early return之前:
```typescript
if (!content.trim() || chatLoadingRef.current) return;
chatLoadingRef.current = true;
```

---

### MF7: `useSpeechSynthesis.ts:114-146` — `setRate` 捕获过期的 `text`

- **文件**: `wiki-viewer/src/hooks/useSpeechSynthesis.ts`
- **行号**: 114-146
- **严重程度**: **MEDIUM**

**问题描述**:
`setRate` 通过 `useCallback(..., [text, playing])` 创建。当用户播放音频时改变语速，回调使用闭包中捕获的 `text` 创建新utterance。如果父组件在 `play()` 调用后更新了 `text` prop，`setRate` 会使用旧文本。

**修复建议**:
使用ref存储text:
```typescript
const textRef = useRef(text);
textRef.current = text;
// setRate中使用 textRef.current
```

---

### MF8: `GraphPage.tsx:200` — `isEditing` 在effect依赖中导致完整图谱重建

- **文件**: `wiki-viewer/src/components/pages/GraphPage.tsx`
- **行号**: 200
- **严重程度**: **MEDIUM**

**问题描述**:
```typescript
}, [graphData, isEditing]);
```
用户切换编辑模式时，整个vis-network `Network` 实例被销毁并重建。对于有数百节点的图谱，这是个开销很大的操作。`isEditing` 唯一目的是控制双击处理器（第184行）。

**修复建议**:
使用ref存储 `isEditing` 在双击处理器中使用，从依赖数组中移除它:
```typescript
const isEditingRef = useRef(isEditing);
isEditingRef.current = isEditing;
// 双击处理器中使用 isEditingRef.current
```

---

### MF9: `MarkdownRenderer.tsx:31-37` — 代码块主题初始状态不可靠

- **文件**: `wiki-viewer/src/components/content/MarkdownRenderer.tsx`
- **行号**: 31-37
- **严重程度**: **MEDIUM**

**问题描述**:
代码块主题从 `data-theme` 属性同步读取，但该属性可能在组件挂载时尚未设置，导致初始渲染闪烁（先light后切换到dark）。

**修复建议**:
使用 `matchMedia('(prefers-color-scheme: dark)').matches` 作为更可靠的初始值。

---

### MF10: `useSpeechSynthesis.test.ts:27,36,45` — 测试与hook签名不匹配

- **文件**: `wiki-viewer/src/hooks/useSpeechSynthesis.test.ts`
- **行号**: 27, 36, 45
- **严重程度**: **MEDIUM**

**问题描述**:
Hook签名是 `useSpeechSynthesis(text: string)`，但三个测试用例都调用 `useSpeechSynthesis()` 无参数。此外 `result.current.play('Hello world')` 传参给了不接受参数的 `play()` 方法。`text` 是hook参数，不是方法参数。

**修复建议**:
重写测试以匹配实际API:
```typescript
const { result } = renderHook(() => useSpeechSynthesis('Hello world'));
act(() => { result.current.play(); });
```
