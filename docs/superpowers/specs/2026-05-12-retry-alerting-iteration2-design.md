# 前端重试与告警系统 — 迭代打磨

> 对 2026-05-12 首次实现的 15 项任务进行 bug 修复 + 稳定性打磨。

## Bug 修复（3 项）

### B1: AlertBanner 不响应 notificationStore alert 变化
- **问题：** `getActiveAlerts()` 直接调用而非 zustand selector，组件不重渲染
- **修复：** 改用 `useNotificationStore((s) => s.notifications)` selector，在 render 中 `.filter(n => n.isAlert)`

### B2: QueryClient 错误观察器每次重试都触发
- **问题：** `getQueryCache().subscribe()` 每次 state change 都回调，3 次重试 = 4+ 次通知
- **修复：** 检查 `fetchFailureCount >= 3` 或 `failureReason` 存在时才推送通知

### B3: RootLayout ResizeObserver 依赖不完整
- **问题：** `useEffect` 依赖只含系统标记，不含 alert 数量
- **修复：** 添加 `alertCount` zustand selector 到依赖数组

## 稳定性打磨（7 项）

### P1: AlertBanner 去重
- `addAlert` 中按 `source` 去重：同一来源的新 alert 替换旧的

### P2: AlertBanner 优先级排序
- critical → warning → success → info，同级按时间倒序

### P3: AlertBanner 暗色模式
- 硬编码 Tailwind 颜色 → CSS 变量 + `dark:` 变体

### P4: 后端离线加手动重试
- `isBackendOffline` 告警添加"重试"按钮，调用 `wikiStore.checkApiHealth()`

### P5: SSE 连接状态指示器
- `useEventStream` 导出 `connectionState: 'connected' | 'connecting' | 'disconnected'`
- Header 显示小圆点：绿/黄/红

### P6: 通知下拉显示告警严重级别
- NotificationDropdown 中 `isAlert` 通知按 `severity` 着色

### P7: useEventStream 导航改为 React Router
- `mapAction` 中 `window.dispatchEvent` → 接收外部 `navigate` 函数
- RootLayout 传入 `useNavigate()`

## 涉及文件
| 文件 | 改动 |
|------|------|
| `wiki-viewer/src/components/ui/AlertBanner.tsx` | B1, P2, P3, P4 |
| `wiki-viewer/src/lib/queryClient.ts` | B2 |
| `wiki-viewer/src/components/layout/RootLayout.tsx` | B3, P7 |
| `wiki-viewer/src/stores/notificationStore.ts` | P1 |
| `wiki-viewer/src/hooks/useEventStream.ts` | P5, P7 |
| `wiki-viewer/src/components/layout/Header.tsx` | P5 |
| `wiki-viewer/src/components/layout/NotificationDropdown.tsx` | P6 |
