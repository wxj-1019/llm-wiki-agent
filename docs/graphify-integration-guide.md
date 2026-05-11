# Graphify 集成指南

> 本指南面向 LLM Wiki Agent 用户和开发者，介绍 Graphify 的完整功能和使用方法。

---

## 1. 快速开始

### 1.1 构建完整图谱

```bash
# 基础构建（仅 wiki）
python tools/build_graph.py

# 包含代码图（推荐）
python tools/build_graph.py --code --no-infer

# 使用 Leiden 社区检测
python tools/build_graph.py --code --leiden --no-infer
```

输出文件：
- `graph/graph.json` — 图谱数据
- `graph/graph.html` — 交互式可视化
- `graph/.cache.json` — 构建缓存

### 1.2 启用自动更新

```bash
# 安装 Git hooks（提交/切换分支后自动重建）
python tools/graphify_hooks.py install

# 启动文件监视器（代码变更后自动增量更新）
python tools/watcher.py --graph

# 查看 hook 状态
python tools/graphify_hooks.py status
```

---

## 2. CLI 命令参考

### 2.1 图谱构建

| 命令 | 说明 |
|------|------|
| `python tools/build_graph.py` | 全量构建 wiki 图谱 |
| `python tools/build_graph.py --code` | 包含代码图 |
| `python tools/build_graph.py --code --leiden` | 使用 Leiden 算法 |
| `python tools/build_graph.py --code --incremental` | 增量构建（仅重解析变化文件） |
| `python tools/build_graph.py --no-infer` | 跳过 LLM 语义推断（更快） |
| `python tools/build_graph.py --open` | 构建后自动打开浏览器 |
| `python tools/build_graph.py --report` | 生成图谱健康报告 |

### 2.2 图谱查询

```bash
# 解释节点
python tools/graph_query.py "explain code/tools/api_server"

# 查找邻居
python tools/graph_query.py "neighbors code/tools/api_server"

# 最短路径
python tools/graph_query.py "path code/tools/api_server code/tools/build_graph"

# 搜索关键词
python tools/graph_query.py "fastapi"

# 查看社区
python tools/graph_query.py "community 12"

# 查看调用关系
python tools/graph_query.py "calls code/tools/api_server"
python tools/graph_query.py "called_by code/tools/api_server"
```

### 2.3 图谱导出

```bash
# 导出 GraphML（Gephi/Cytoscape 可用）
python -c "from tools.shared.graph_export import export_graphml; print(export_graphml())"

# 导出 CSV
python -c "from tools.shared.graph_export import export_csv; print(export_csv())"

# 导出 Cypher（Neo4j）
python -c "from tools.shared.graph_export import export_cypher; print(export_cypher()[:500])"

# 全部导出
python -c "from tools.shared.graph_export import export_all; print(export_all())"
```

### 2.4 Git Hooks

```bash
python tools/graphify_hooks.py install     # 安装
python tools/graphify_hooks.py uninstall   # 卸载
python tools/graphify_hooks.py status      # 查看状态
```

### 2.5 文件监视器

```bash
python tools/watcher.py              # 仅监视 raw/ 自动 ingest
python tools/watcher.py --graph      # 同时监视代码目录自动重建图谱
python tools/watcher.py --once       # 处理现有文件后退出
python tools/watcher.py --poll       # 使用轮询（无 watchdog 时）
```

---

## 3. API 参考

### 3.1 图谱统计

```bash
curl http://127.0.0.1:8666/api/graph/stats
```

响应：
```json
{
  "node_count": 1958,
  "edge_count": 3000,
  "community_count": 94,
  "type_distribution": {
    "code_module": 209,
    "code_func": 1290,
    "code_class": 181,
    "source": 35,
    "entity": 173,
    "concept": 66,
    "synthesis": 4
  }
}
```

### 3.2 图谱查询

```bash
curl -X POST http://127.0.0.1:8666/api/graph/query \
  -H "Content-Type: application/json" \
  -d '{"query": "explain code/tools/api_server"}'
```

### 3.3 节点详情

```bash
curl http://127.0.0.1:8666/api/graph/node/code/tools/api_server
```

### 3.4 图谱导出

```bash
curl -X POST http://127.0.0.1:8666/api/graph/export \
  -H "Content-Type: application/json" \
  -d '{"format": "graphml"}'
```

支持的 format：`all`, `graphml`, `csv`, `cypher`

### 3.5 获取完整图谱

```bash
curl http://127.0.0.1:8666/api/graph
```

---

## 4. 架构说明

### 4.1 插件化解析器

```
tools/shared/code_graph/
├── base.py              # CodeNode, CodeEdge, CodeParser 协议
├── registry.py          # 解析器注册表
├── python_parser.py     # Python (tree-sitter)
├── typescript_parser.py # TypeScript / JavaScript (tree-sitter)
├── builder.py           # 扫描目录 + 增量构建
└── __init__.py          # 自动注册
```

注册新语言：
```python
from tools.shared.code_graph import register_parser
from tools.shared.code_graph.base import CodeParser

class GoParser(CodeParser):
    @property
    def supported_extensions(self):
        return {".go"}
    def parse(self, path, repo_root):
        # ... 返回 (nodes, edges)
        return [], []

register_parser(GoParser())
```

### 4.2 增量构建原理

1. 代码文件 hash 缓存在 `.cache.json["_code_hashes"]`
2. 对比当前文件 hash 与缓存 hash
3. **未变化文件**：保留现有节点和边
4. **变化文件**：重新解析，替换旧节点和边
5. **新增文件**：解析并添加
6. **删除文件**：移除对应节点和边
7. Wiki 部分正常重新构建（wikilink 提取很快）

### 4.3 社区检测对比

| 特性 | Louvain | Leiden |
|------|---------|--------|
| 速度 | 更快 (~80ms) | 稍慢 (~120ms) |
| 社区数 | 更多 (94) | 更少 (84) |
| 稳定性 | 可能震荡 | 保证收敛 |
| 连通性 | 不保证 | 保证子图连通 |
| 适用场景 | 快速预览 | 生产环境 |

---

## 5. 故障排除

### 5.1 图谱为空

```bash
# 检查 graph.json 是否存在
ls graph/graph.json

# 重新构建
python tools/build_graph.py --code --no-infer
```

### 5.2 tree-sitter 解析失败

```bash
# 确认已安装
pip install tree-sitter tree-sitter-python tree-sitter-typescript tree-sitter-javascript

# 验证解析器注册
python -c "from tools.shared.code_graph import list_parsers; print(list_parsers())"
# 预期输出：['py', 'tsx', 'ts', 'js', 'jsx']
```

### 5.3 增量构建未生效

```bash
# 检查缓存文件
python -c "import json; d=json.load(open('graph/.cache.json')); print('_code_hashes' in d)"

# 如果为 False，先运行一次全量构建
python tools/build_graph.py --code --no-infer

# 再运行增量
python tools/build_graph.py --code --incremental --no-infer
```

### 5.4 Leiden 不可用

```bash
pip install python-igraph leidenalg
python -c "import leidenalg; print(leidenalg.__version__)"
```

---

## 6. 扩展阅读

- [性能基准](benchmarks/graph-perf.md)
- [集成方案](../plan/graphify-integration-plan.md)
- [AGENTS.md](../../AGENTS.md) — 项目规范
