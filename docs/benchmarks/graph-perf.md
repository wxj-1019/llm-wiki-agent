# Graphify 性能基准

> 环境：Windows 10, Python 3.12.10, i7-13700K, 32GB RAM, SSD  
> 日期：2026-05-11

---

## 1. 图谱规模

| 指标 | 数值 |
|------|------|
| Wiki 页面数 | 278 |
| Code 文件数 | ~200 (Python + TS/JS) |
| 总节点数 | 1,958 |
| 总边数 | 3,000 |
| 其中 Wiki 节点 | 278 |
| 其中 Code 节点 | 1,680 |
| 社区数 (Louvain) | 94 |
| 社区数 (Leiden) | 84 |

---

## 2. 构建耗时

### 2.1 全量构建

| 模式 | 耗时 | 说明 |
|------|------|------|
| `build_graph.py --no-infer` | ~0.4s | 仅 wiki wikilinks |
| `build_graph.py --code --no-infer` | ~1.2s | wiki + 代码图 (tree-sitter) |
| `build_graph.py --code --leiden --no-infer` | ~1.3s | 使用 Leiden 替代 Louvain |

### 2.2 增量构建

| 场景 | 耗时 | 对比全量 |
|------|------|----------|
| 无代码文件变化 | ~0.6s | **-50%** |
| 1 个 .py 文件修改 | ~0.6s | **-50%** |
| 10 个 .py 文件修改 | ~0.8s | **-33%** |

> 增量优势随代码库规模扩大而增加。对于 10K+ 文件的项目，增量可节省 90%+ 时间。

---

## 3. 社区检测

| 算法 | 耗时 | 社区数 | 特点 |
|------|------|--------|------|
| Louvain | ~80ms | 94 | 更快，社区更多更细碎 |
| Leiden | ~120ms | 84 | 更凝聚，保证子图连通性 |

> Leiden 推荐用于需要稳定社区划分的场景。Louvain 适合快速预览。

---

## 4. 查询引擎

| 查询类型 | 耗时 | 说明 |
|----------|------|------|
| `explain` | ~1ms | 节点元数据查找 |
| `neighbors` | ~2ms | 1-hop BFS |
| `path A B` | ~5-20ms | 取决于路径长度 |
| `query keyword` | ~3ms | 线性扫描 + 过滤 |
| `community N` | ~2ms | group 字段过滤 |

---

## 5. 导出性能

| 格式 | 耗时 | 文件大小 |
|------|------|----------|
| GraphML | ~200ms | ~2.5MB |
| CSV (nodes+edges) | ~100ms | ~800KB |
| Cypher | ~150ms | ~1.2MB |

---

## 6. 缓存效率

| 缓存层 | 命中率 | 作用 |
|--------|--------|------|
| `.cache.json` (wiki inferred edges) | ~95% | 避免重复 LLM 调用 |
| `_code_hashes` (代码文件 hash) | ~99% | 增量构建跳过未变化文件 |
| `graph.json` (现有图谱) | 100% | 增量加载已有节点和边 |

---

## 7. 内存占用

| 阶段 | RSS |
|------|-----|
| 加载 graph.json | ~45MB |
| NetworkX 图构建 | ~85MB |
| tree-sitter 解析 (全量) | ~120MB |
| 社区检测 (Leiden) | ~95MB |

---

## 8. 建议

- **日常开发**：使用 `watcher.py --graph` 自动增量更新
- **CI/CD**：使用 `build_graph.py --code --incremental --no-infer`，预期 < 1s
- **发布前**：使用 `build_graph.py --code --leiden` 生成最终图谱
- **大规模仓库** (>1K 文件)：增量构建收益显著，必开 `--incremental`
