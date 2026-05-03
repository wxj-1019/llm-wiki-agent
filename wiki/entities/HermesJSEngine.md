---
title: "HermesJSEngine"
type: entity
tags: [javascript-engine, react-native, meta, mobile]
sources: [github-hermes-ecosystem]
last_updated: 2026-05-02
---

> **Disambiguation**: This page is about **Hermes**, the JavaScript engine by [[Meta]] for [[ReactNative]]. For the AI Agent framework also named Hermes, see [[HermesAgent]].

## Overview

Hermes 是由 Meta（Facebook）开发的 JavaScript 引擎，专为 React Native 优化。从 React Native 0.69.0 开始，Hermes 作为默认 JS 引擎与 React Native 捆绑发布（Bundled Hermes）。GitHub 星标数 11,017。它与 NousResearch 的 [[HermesAgent]]（AI Agent 框架）是完全无关的项目，仅名称相同。

## Core Features

### 1. AOT 编译优化
- 提前编译 JavaScript 为紧凑字节码（bytecode）
- 显著减少运行时解析和编译开销
- 应用启动时间大幅缩短

### 2. 性能优势
- **启动时间**：相比 JavaScriptCore 大幅改善
- **内存使用**：更低的内存占用
- **应用体积**：更小的打包尺寸

### 3. Bundled Hermes
- 每个 React Native 版本都附带对应版本的 Hermes
- 版本严格匹配，避免兼容性问题

## Technical Details

- **语言**：C++（引擎核心）+ JavaScript
- **许可证**：MIT
- **仓库**：github.com/facebook/hermes
- **支持平台**：Android、iOS
- **构建系统**：CMake

## Usage

```bash
# React Native 默认启用，无需额外配置
npx react-native init MyApp
cd MyApp && npx react-native run-android
```

## Connections

- [[Meta]] — 开发公司
- [[ReactNative]] — 目标运行平台
