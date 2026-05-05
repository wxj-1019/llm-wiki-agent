# Bug 审查报告索引

> 审查日期: 2026-05-06  
> 审查范围: 全项目 (Python工具链 + React前端 + 配置/基础设施)

## 概览

| 严重程度 | 数量 | 文档 |
|----------|------|------|
| **CRITICAL** | 3 | [critical-and-high.md](critical-and-high.md) |
| **HIGH** | 14 | [critical-and-high.md](critical-and-high.md) |
| **MEDIUM (后端)** | 20 | [medium-backend.md](medium-backend.md) |
| **MEDIUM (前端)** | 10 | [medium-frontend.md](medium-frontend.md) |
| **LOW** | 16 | [low-severity.md](low-severity.md) |
| **总计** | **63** | |

## 最需要优先修复的问题

1. **`build_graph.py:354`** → NameError 崩溃, 语义推理Pass 2完全不可用
2. **`scheduler.py:33`** → Windows下路径包含空格时崩溃
3. **`wikiStore.ts:76`** → 未声明变量 `_persistTimer`, 运行时JS错误
4. **`ingest.py:105-107,170-173`** → 函数重复定义覆盖shared模块导入
5. **`mcp_manager.py:220`** → 路径遍历安全检查缺失, 可执行任意文件
6. **`requirements.txt`** → 缺少 `markitdown[all]`, `tqdm`, `schedule` 依赖
