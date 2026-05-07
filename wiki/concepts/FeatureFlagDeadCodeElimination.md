---
title: "Feature Flag Dead Code Elimination"
type: concept
tags: [compilation, build-system, feature-flags]
sources: [latte-claude-code-fork]
last_updated: 2026-05-08
---

# Feature Flag Dead Code Elimination (DCE)

**Feature Flag DCE** 是一种编译时优化技术，通过条件编译将未启用的功能代码在构建时彻底移除，从而减小二进制体积并提高运行时性能。

## 在 [[Latte]] 中的实现

Latte 通过 [[Bun]] 的 `bun:bundle` 的 `feature()` 函数实现此机制：

```typescript
// 示例：仅在 BRIDGE_MODE 启用时包含桥接模式代码
if (feature('BRIDGE_MODE')) {
  // 桥接模式实现
}
```

- 默认启用的 feature：`VOICE_MODE`
- 完整实验性功能集包含 54 个 flags（如 BRIDGE_MODE、ULTRAPLAN、ULTRATHINK、AGENT_TRIGGERS、KAIROS 等）
- 默认所有实验性功能关闭，完整功能构建通过 `--feature-set=dev-full` 启用

## 优势

- **减少二进制体积** — 未使用代码在编译时被整体移除
- **提高安全性** — 未启用的实验性功能不会出现在生产构建中
- **灵活性** — 同一代码库可以编译出不同功能集的版本

## Connections

- [[Bun]] — 提供 `feature()` 函数实现 DCE
- [[Latte]] — 项目中大量使用此技术
