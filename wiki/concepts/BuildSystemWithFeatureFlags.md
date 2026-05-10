---
title: "BuildSystemWithFeatureFlags"
type: concept
tags: [build-system, feature-flags, bundler]
sources: [claude-code-claude-md-guide]
last_updated: 2026-05-10
---

构建系统中的功能标志打包器是一种通过命令行参数控制哪些功能被包含在最终构建输出中的技术。在 [[ClaudeCode]] 项目中，`scripts/build.ts` 扮演此角色，支持通过 `--feature` 参数设置特定功能（如 `ULTRAPLAN`）或通过 `--feature-set` 预设（如 `dev-full`）批量启用。这种方法允许为不同场景（开发、生产、实验）生成不同的 CLI 二进制文件。