# Jarvis → Main Page Integration Plan

> **Goal:** 将 JarvisPage 设为首页，压缩高度消除滚动条

**Architecture:** 路由指向 JarvisPage，RootLayout 控高 overflow-hidden，JarvisPage 内部全局压缩纵向空间

---

### Task 1: 路由 — JarvisPage 设为首页

**Files:** Modify `wiki-viewer/src/router.tsx:35`

- 将 `{ path: '/', element: <HomePage /> }` 改为 `{ path: '/', element: <LazyPage><JarvisPage /></LazyPage> }`

### Task 2: RootLayout — 消除主区域滚动

**Files:** Modify `wiki-viewer/src/components/layout/RootLayout.tsx:146,148`

- `overflow-y-auto` → `overflow-hidden`
- `py-8` → `py-1`

### Task 3: JarvisPage — 全局压缩高度

**Files:** Modify `wiki-viewer/src/components/pages/JarvisPage.tsx`

- NeuralPulseBar: 减小高度（通过父容器限制）
- Header: `py-1` → `py-0.5`, 标题 `text-lg` → `text-sm`
- Chat 消息区: `space-y-4` → `space-y-1.5`
- Kanban/Evolution/Insights 视图: 减少 padding
- GoalInput: `pt-2 pb-0` → `pt-1 pb-0`
