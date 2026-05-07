---
title: "Platform Subpackage Publishing"
type: concept
tags: [npm, publishing, cross-platform]
sources: [latte-claude-code-fork]
last_updated: 2026-05-08
---

# Platform Subpackage Publishing

**平台分包发布**是一种将跨平台二进制托管到 NPM 的行业标准做法，与 esbuild、prisma 等工具的发布模式相同。

## 在 [[Latte]] 中的实现

Latte 项目将二进制文件按平台分包发布到 npm Registry：

- **主包** `latte` — 约 5KB，包含平台检测启动脚本 `bin/latte.js`
- **平台子包** `latte-code-<platform>-<arch>`：
  - `latte-code-darwin-x64` — macOS Intel
  - `latte-code-darwin-arm64` — macOS Apple Silicon
  - `latte-code-linux-x64` — Linux x64
  - `latte-code-linux-arm64` — Linux arm64
  - `latte-code-win32-x64` — Windows x64

主包通过 `optionalDependencies` 引用所有子包，npm 在安装时自动下载与当前平台匹配的子包。

## 发布流程

```bash
# 手动发布
bun run publish:npm -- --binary-dir ./dist/binaries

# CI/CD 自动发布（GitHub Actions Matrix）
# 5 个平台并行编译 → 收集 artifacts → 统一发布
```

## 优势

- 用户只需 `npm install -g` 即可使用，无需关心平台
- NPM 自动处理平台匹配
- 子包仅包含特定平台的二进制，节省带宽

## Connections

- [[Bun]] — 编译工具
- [[Latte]] — 采用此模式的项目
