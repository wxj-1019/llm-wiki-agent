# Jarvis → Main Page Integration Design

## Goal
将 JarvisPage 全部内容整合到主页面，压缩高度消除滚动条。

## Changes

### 1. RootLayout.tsx
- 主区域 `main` 移除 `overflow-y-auto`，改为 `overflow-hidden`
- 内容 wrapper 移除 `py-8`，改为 `py-2`，并设置 `h-full`
- 用 `calc(100vh - 56px - bannerHeight)` 精确控高

### 2. JarvisPage.tsx — 全局压缩
- `NeuralPulseBar`: 高度从默认缩小
- Header 区域: 减少 padding，缩小标题字号
- Chat 消息区: 减少 `space-y-4` → `space-y-2`
- `GoalInput`: 压缩高度
- 错误 toast: 位置调整

### 3. 路由（待确认）
- Jarvis 页面需确认当前路由配置，可能需要将 `/jarvis` 内容作为首页或嵌入 `/`

## Non-goals
- 不改变四个视图切换逻辑
- 不改动后端 API
