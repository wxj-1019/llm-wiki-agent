# Graphify 深度集成方案

> 版本: 1.0  
> 日期: 2026-05-11  
> 目标: 将 Graphify 精华能力深度集成到 LLM Wiki Agent，实现"代码+文档"统一知识图谱

---

## 一、集成架构总览

### 1.1 当前架构痛点

```
┌─────────────────────────────────────────────┐
│           LLM Wiki Agent (当前)              │
├─────────────────────────────────────────────┤
│  wiki/          ← 文档知识层 (markdown)      │
│  tools/         ← 工具代码层 (python)       │
│  wiki-viewer/   ← 前端代码层 (typescript)   │
├─────────────────────────────────────────────┤
│  build_graph.py  ──→ 只扫描 wiki/*.md       │
│  ingest.py       ──→ 只处理文档             │
│  query.py        ──→ 基于 wiki 内容问答     │
└─────────────────────────────────────────────┘
          ❌ 代码与文档知识割裂
          ❌ 无法回答"哪些工具调用了 X"
          ❌ 图谱只覆盖文档，不覆盖代码
```

### 1.2 集成后架构

```
┌─────────────────────────────────────────────────────────────┐
│              LLM Wiki Agent + Graphify (目标)               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Wiki Layer │  │  Code Layer │  │   Graphify Engine   │ │
│  │  (markdown) │  │  (AST-based)│  │  (query/export/hook)│ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                    │            │
│         └────────────────┼────────────────────┘            │
│                          ▼                                 │
│              ┌─────────────────────┐                       │
│              │   Unified Graph     │                       │
│              │  (wiki + code edges)│                       │
│              └─────────────────────┘                       │
│                          │                                 │
│         ┌────────────────┼────────────────┐               │
│         ▼                ▼                ▼               │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────┐     │
│  │ vis.js   │   │  Natural Lang │   │  Multi-Format│     │
│  │   viz    │   │    Query      │   │    Export    │     │
│  └──────────┘   └──────────────┘   └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 集成边界

| 组件 | 复用 Graphify | 自研/现有 | 说明 |
|------|--------------|-----------|------|
| **tree-sitter AST** | ✅ 理念 + 部分实现 | ✅ code_graph.py 扩展 | 当前仅 Python/TS，扩展至 5+ 语言 |
| **wikilink 提取** | ✅ 正则增强 | ✅ wiki.py 已增强 | 已支持 `#heading` anchor |
| **Leiden 社区检测** | ✅ 算法替换 | ✅ 替换 Louvain | 使用 `python-igraph` + `leidenalg` |
| **SHA256 缓存** | ✅ 理念一致 | ✅ 已有实现 | 扩展至代码文件 |
| **git hooks** | ✅ 理念复用 | ✅ 新增 `tools/graphify_hooks.py` | post-commit 自动重建 |
| **watch mode** | ✅ 理念复用 | ✅ watcher.py 扩展 | 文件变动触发增量图谱更新 |
| **自然语言查询** | ✅ query/path/explain | ✅ 新增 API 端点 | `/api/graph/query` |
| **多格式导出** | ✅ GraphML/Neo4j | ✅ 新增导出模块 | 保留现有 HTML，新增 GraphML |
| **LLM 语义推断** | ❌ 不使用 | ✅ 现有 build_graph.py | 保留现有 INFERRED 边机制 |

---

## 二、核心功能集成方案

### 2.1 代码图谱增强（tree-sitter 多语言支持）

**当前状态：** `tools/shared/code_graph.py` 仅支持 Python (`ast` 模块) + TypeScript (正则)。

**目标：** 支持 Python / TypeScript / JavaScript / Go / Rust / Markdown / YAML / JSON

#### 2.1.1 技术方案

引入 `tree-sitter` 作为可选依赖，提供统一的 AST 解析层：

```
tools/shared/code_graph/
├── __init__.py              # build_code_graph() 统一入口
├── base.py                  # BaseParser 抽象类
├── python_parser.py         # tree-sitter-python (替代内置 ast)
├── typescript_parser.py     # tree-sitter-typescript
├── javascript_parser.py     # tree-sitter-javascript
├── go_parser.py             # tree-sitter-go
├── markdown_parser.py       # 提取 heading 作为代码文档节点
└── registry.py              # 文件后缀 → Parser 映射
```

#### 2.1.2 节点类型扩展

| 节点类型 | 说明 | 来源 |
|----------|------|------|
| `code_module` | 文件模块 | 所有代码文件 |
| `code_package` | 包/目录 | `__init__.py`, `package.json` |
| `code_class` | 类定义 | AST class 节点 |
| `code_func` | 函数/方法 | AST function 节点 |
| `code_interface` | TypeScript interface | AST interface 节点 |
| `code_struct` | Go/Rust struct | AST struct 节点 |
| `doc_section` | Markdown heading | `# Heading` → 子节点 |

#### 2.1.3 边类型扩展

| 边类型 | 说明 | 置信度 |
|--------|------|--------|
| `IMPORTS` | import/from 导入关系 | 1.0 (EXTRACTED) |
| `INHERITS` | 类继承 | 1.0 (EXTRACTED) |
| `IMPLEMENTS` | interface 实现 | 1.0 (EXTRACTED) |
| `CALLS` | 函数调用 | 0.8 (INFERRED) |
| `CONTAINS` | 模块包含函数/类 | 1.0 (EXTRACTED) |
| `REFERENCES` | 文档引用代码 | 0.9 (INFERRED) |
| `DEPENDS_ON` | package.json/requirements 依赖 | 1.0 (EXTRACTED) |

#### 2.1.4 实现代码骨架

```python
# tools/shared/code_graph/__init__.py
from __future__ import annotations

from pathlib import Path
from typing import Protocol

class CodeParser(Protocol):
    """统一代码解析器接口，所有语言解析器必须实现。"""
    
    @property
    def supported_extensions(self) -> set[str]: ...
    
    def parse(self, path: Path) -> tuple[list[dict], list[dict]]:
        """Return (nodes, edges) for a single file."""
        ...

# 注册表
_PARSERS: dict[str, CodeParser] = {}

def register_parser(parser: CodeParser) -> None:
    for ext in parser.supported_extensions:
        _PARSERS[ext] = parser

def build_code_graph() -> tuple[list[dict], list[dict]]:
    all_nodes, all_edges = [], []
    for path in _iter_source_files():
        parser = _PARSERS.get(path.suffix)
        if parser:
            n, e = parser.parse(path)
            all_nodes.extend(n)
            all_edges.extend(e)
    return all_nodes, all_edges
```

---

### 2.2 Leiden 社区检测（替换 Louvain）

**当前状态：** 使用 networkx.algorithms.community.louvain_communities

**目标：** 替换为 Leiden 算法（分辨率更好，社区更稳定）

#### 2.2.1 技术方案

使用 `python-igraph` + `leidenalg` 实现：

```python
# tools/shared/graph_community.py
from __future__ import annotations

try:
    import igraph as ig
    import leidenalg as la
    HAS_LEIDEN = True
except ImportError:
    HAS_LEIDEN = False


def detect_communities_leiden(nodes: list[dict], edges: list[dict]) -> dict[str, int]:
    """Leiden community detection — higher resolution than Louvain."""
    if not HAS_LEIDEN:
        # Fallback to existing Louvain
        from networkx.algorithms import community as nx_community
        import networkx as nx
        G = nx.Graph()
        for n in nodes:
            G.add_node(n["id"])
        for e in edges:
            G.add_edge(e["from"], e["to"], weight=e.get("confidence", 1.0))
        communities = nx_community.louvain_communities(G, seed=42)
        return {node: i for i, comm in enumerate(communities) for node in comm}

    # Build igraph
    g = ig.Graph(directed=False)
    node_ids = [n["id"] for n in nodes]
    id_to_idx = {nid: i for i, nid in enumerate(node_ids)}
    g.add_vertices(len(node_ids))
    g.vs["name"] = node_ids
    
    edge_list = []
    weights = []
    for e in edges:
        if e["from"] in id_to_idx and e["to"] in id_to_idx:
            edge_list.append((id_to_idx[e["from"]], id_to_idx[e["to"]]))
            weights.append(e.get("confidence", 1.0))
    
    g.add_edges(edge_list)
    g.es["weight"] = weights
    
    # Leiden algorithm with CPM (Constant Potts Model) for better resolution
    partition = la.find_partition(
        g,
        la.CPMVertexPartition,
        weights="weight",
        resolution_parameter=0.05,  # Tune: lower = larger communities
        n_iterations=-1,  # Iterate until convergence
        seed=42,
    )
    
    return {node_ids[i]: comm for comm, members in enumerate(partition) for i in members}
```

#### 2.2.2 性能对比预期

| 算法 | 分辨率 | 稳定性 | 适合场景 |
|------|--------|--------|----------|
| Louvain (当前) | 较低 | 随机种子依赖 | 快速粗略聚类 |
| **Leiden** | **更高** | **更稳定** | **精细社区发现** |

> 预期收益：社区数量增加 20-40%，边界更清晰，hub 节点分布更合理。

---

### 2.3 自然语言查询引擎（query / path / explain）

**当前状态：** 无自然语言查询能力，只能通过 wiki 内容搜索。

**目标：** 实现 Graphify 风格的 `query` / `path` / `explain` 命令。

#### 2.3.1 查询语言设计

```python
# tools/graph_query.py
"""
Graphify-style natural language queries over the unified graph.

Queries:
    query "what connects auth to database?"
    path  "UserService" "DatabasePool"
    explain "RateLimiter"
    neighbors "api_server.py" --depth 2
    community "tools/jarvis" --include-code
"""
```

#### 2.3.2 实现架构

```
┌────────────────────────────────────────────────────────┐
│                    Graph Query Engine                   │
├────────────────────────────────────────────────────────┤
│  1. Query Parser (轻量 LLM / 规则解析)                 │
│     "what connects auth to database?"                  │
│     → intent: CONNECT, entities: ["auth", "database"]  │
├────────────────────────────────────────────────────────┤
│  2. Entity Resolution                                  │
│     "auth" → wiki/concepts/Auth.md                     │
│            → code/tools/jarvis/auth.py                 │
│     "database" → wiki/entities/PostgreSQL.md           │
│                → code/tools/jarvis/jarvis_pg.py        │
├────────────────────────────────────────────────────────┤
│  3. Graph Traversal                                    │
│     - BFS/DFS path finding                             │
│     - Shortest path with weighted edges                │
│     - Community-aware routing                          │
├────────────────────────────────────────────────────────┤
│  4. Result Formatter                                   │
│     - Path with node descriptions                      │
│     - Community context                                │
│     - Edge confidence scores                           │
└────────────────────────────────────────────────────────┘
```

#### 2.3.3 API 端点设计

```python
# tools/api_server.py 新增端点

@app.post("/api/graph/query")
def graph_query(payload: GraphQueryRequest):
    """
    Natural language query over the unified graph.
    
    Example payload:
    {
        "query": "what connects auth to database?",
        "depth": 3,
        "include_code": true,
        "min_confidence": 0.5
    }
    """
    ...

@app.post("/api/graph/path")
def graph_path(payload: GraphPathRequest):
    """Find shortest path between two nodes."""
    ...

@app.post("/api/graph/explain")
def graph_explain(payload: GraphExplainRequest):
    """Explain a node's role in the graph (degree, community, key connections)."""
    ...

@app.get("/api/graph/neighbors/{node_id}")
def graph_neighbors(node_id: str, depth: int = 1):
    """Get neighbors of a node up to N hops."""
    ...
```

#### 2.3.4 查询解析实现（轻量规则版）

```python
# tools/shared/graph_query_engine.py
import re
from dataclasses import dataclass
from enum import Enum

class QueryIntent(Enum):
    CONNECT = "connect"      # what connects X to Y?
    PATH = "path"            # path from X to Y
    EXPLAIN = "explain"      # explain X
    NEIGHBORS = "neighbors"  # what is connected to X?
    SIMILAR = "similar"      # what is similar to X?

@dataclass
class ParsedQuery:
    intent: QueryIntent
    entities: list[str]
    constraints: dict

_QUERY_PATTERNS = [
    (QueryIntent.CONNECT, r"what connects? (?P<a>.+?) (?:to|with) (?P<b>.+?)"),
    (QueryIntent.PATH, r"path (?:from )?(?P<a>.+?) (?:to|→) (?P<b>.+?)"),
    (QueryIntent.EXPLAIN, r"explain (?P<a>.+)"),
    (QueryIntent.NEIGHBORS, r"(?:what is connected to|neighbors of) (?P<a>.+)"),
    (QueryIntent.SIMILAR, r"(?:what is similar to|like) (?P<a>.+)"),
]

def parse_query(query: str) -> ParsedQuery | None:
    q = query.lower().strip().rstrip("?")
    for intent, pattern in _QUERY_PATTERNS:
        m = re.search(pattern, q)
        if m:
            entities = [v.strip() for v in m.groupdict().values()]
            return ParsedQuery(intent=intent, entities=entities, constraints={})
    return None
```

---

### 2.4 多格式导出（GraphML / Neo4j / Obsidian）

**当前状态：** 仅支持 vis.js HTML 可视化。

**目标：** 支持 GraphML（Gephi/yEd）、Neo4j Cypher、Obsidian Vault。

#### 2.4.1 GraphML 导出

```python
# tools/shared/graph_export.py

def export_graphml(nodes: list[dict], edges: list[dict], output: Path) -> None:
    """Export to GraphML for Gephi / yEd analysis."""
    xml = ["""<?xml version="1.0" encoding="UTF-8"?>""",
           """<graphml xmlns="http://graphml.graphdrawing.org/xmlns">""",
           """  <key id="label" for="node" attr.name="label" attr.type="string"/>""",
           """  <key id="type" for="node" attr.name="type" attr.type="string"/>""",
           """  <key id="confidence" for="edge" attr.name="confidence" attr.type="double"/>""",
           """  <graph id="G" edgedefault="undirected">"""]
    
    for n in nodes:
        xml.append(f'    <node id="{n["id"]}">')
        xml.append(f'      <data key="label">{n.get("label", n["id"])}</data>')
        xml.append(f'      <data key="type">{n.get("type", "unknown")}</data>')
        xml.append('    </node>')
    
    for e in edges:
        xml.append(f'    <edge source="{e["from"]}" target="{e["to"]}">')
        xml.append(f'      <data key="confidence">{e.get("confidence", 1.0)}</data>')
        xml.append('    </edge>')
    
    xml.append("  </graph>")
    xml.append("</graphml>")
    
    output.write_text("\n".join(xml), encoding="utf-8")
```

#### 2.4.2 Neo4j Cypher 导出

```python
def export_neo4j(nodes: list[dict], edges: list[dict], output: Path) -> None:
    """Generate Cypher statements for Neo4j import."""
    lines = ["// Nodes"]
    for n in nodes:
        props = {
            "id": n["id"],
            "label": n.get("label", n["id"]),
            "type": n.get("type", "unknown"),
        }
        if "path" in n:
            props["path"] = n["path"]
        props_str = ", ".join(f'{k}: "{v}"' for k, v in props.items())
        lines.append(f"CREATE (:{n.get('type', 'Node').upper()} {{{props_str}}})")
    
    lines.append("\n// Edges")
    for e in edges:
        rel = e.get("type", "RELATES_TO")
        lines.append(f'MATCH (a {{id: "{e["from"]}"}}), (b {{id: "{e["to"]}"}})')
        lines.append(f'CREATE (a)-[:{rel} {{confidence: {e.get("confidence", 1.0)}}}]->(b)')
    
    output.write_text("\n".join(lines), encoding="utf-8")
```

#### 2.4.3 CLI 集成

```bash
python tools/build_graph.py --export graphml    # graph/graph.graphml
python tools/build_graph.py --export neo4j      # graph/graph.cypher
python tools/build_graph.py --export obsidian   # graph/obsidian-vault/
python tools/build_graph.py --export all        # 全部导出
```

---

### 2.5 Git Hooks + Watch Mode（自动重建）

**当前状态：** `watcher.py` 监控 `raw/` 目录，build_graph.py 需手动运行。

**目标：** 实现 Graphify 风格的 post-commit 自动重建 + 文件变动 watch。

#### 2.5.1 Git Hook 安装

```python
# tools/graphify_hooks.py
"""Install/uninstall git hooks for auto graph rebuild."""

from pathlib import Path
import sys

REPO = Path(__file__).parent.parent
HOOKS_DIR = REPO / ".git" / "hooks"

POST_COMMIT_HOOK = """#!/bin/sh
# Auto-rebuild graph on commit (installed by graphify_hooks.py)
python tools/build_graph.py --code --no-infer >> .git/graph_rebuild.log 2>&1 &
"""

def install_hooks():
    hook_path = HOOKS_DIR / "post-commit"
    hook_path.write_text(POST_COMMIT_HOOK, encoding="utf-8")
    # On Windows, git hooks must be executable (chmod not available, but .sh extension works)
    print(f"Installed post-commit hook: {hook_path}")

def uninstall_hooks():
    hook_path = HOOKS_DIR / "post-commit"
    if hook_path.exists():
        hook_path.unlink()
        print(f"Removed post-commit hook: {hook_path}")
```

#### 2.5.2 Watch Mode 增强

扩展现有 `watcher.py`，在检测到代码文件变动时触发增量图谱更新：

```python
# 在 watcher.py 中添加
GRAPH_REBUILD_DELAY = 30  # seconds

class GraphRebuildHandler(FileSystemEventHandler):
    """Trigger incremental graph rebuild on code/wiki changes."""
    
    def __init__(self):
        self._timer = None
    
    def on_any_event(self, event):
        if event.is_directory:
            return
        if event.src_path.endswith(('.md', '.py', '.ts', '.tsx', '.go', '.rs')):
            if self._timer:
                self._timer.cancel()
            self._timer = threading.Timer(GRAPH_REBUILD_DELAY, self._rebuild)
            self._timer.start()
    
    def _rebuild(self):
        subprocess.run([sys.executable, "tools/build_graph.py", "--code", "--no-infer"])
```

---

## 三、数据模型扩展

### 3.1 graph.json Schema 扩展

```json
{
  "nodes": [
    {
      "id": "concepts/Transformer",
      "label": "Transformer",
      "type": "concept",
      "color": "#FF9800",
      "path": "wiki/concepts/Transformer.md",
      "group": 3,
      "value": 12,
      "community": 3,
      "centrality": 0.85
    },
    {
      "id": "code/tools/api_server",
      "label": "api_server.py",
      "type": "code_module",
      "color": "#607D8B",
      "path": "tools/api_server.py",
      "language": "python",
      "group": 7,
      "value": 8,
      "community": 7,
      "centrality": 0.72
    }
  ],
  "edges": [
    {
      "id": "concepts/Transformer->entities/OpenAI:EXTRACTED",
      "from": "concepts/Transformer",
      "to": "entities/OpenAI",
      "type": "EXTRACTED",
      "color": "#555555",
      "confidence": 1.0
    },
    {
      "id": "code/tools/api_server->code/tools/jarvis/jarvis_pg:IMPORTS",
      "from": "code/tools/api_server",
      "to": "code/tools/jarvis/jarvis_pg",
      "type": "IMPORTS",
      "color": "#4CAF50",
      "confidence": 1.0
    }
  ],
  "meta": {
    "built": "2026-05-11",
    "node_count": 1877,
    "edge_count": 2975,
    "community_count": 12,
    "wiki_nodes": 278,
    "code_nodes": 1599,
    "algorithms": {
      "community": "leiden",
      "resolution": 0.05
    }
  }
}
```

### 3.2 vis.js 配置扩展

支持按类型过滤 + 社区高亮：

```javascript
// graph.html 中新增控制面板
const filters = {
  showWiki: true,
  showCode: true,
  showInferred: false,
  selectedCommunity: null,
};
```

---

## 四、实施路线图

### Phase 1: 基础架构（Week 1） ✅ 已完成

| 任务 | 状态 | 交付物 | 验收结果 |
|------|------|--------|----------|
| 安装 tree-sitter + 语言包 | ✅ | `requirements.txt` 已含 | `py`, `tsx`, `js` 解析器注册成功 |
| 重构 code_graph.py 为插件架构 | ✅ | `tools/shared/code_graph/` 目录 | 7 个文件：`base.py`, `registry.py`, `_utils.py`, `python_parser.py`, `typescript_parser.py`, `builder.py`, `__init__.py` |
| 集成 Leiden 算法 | ✅ | 集成到 `build_graph.py` | `python-igraph 1.0.0` + `leidenalg 0.11.0`，`--leiden` 参数可用 |
| 更新 build_graph.py 社区检测调用 | ✅ | `build_graph.py` diff | `detect_communities(nodes, edges, use_leiden=True)` 支持动态切换 |

**Phase 1 运行结果：**
- 完整代码图构建：`1638 code nodes, 1726 code edges`（对比旧版 MVP 的 1601/1771）
- Leiden 社区数：`84`（Louvain 为 `94`），社区更凝聚
- TS 解析器成功解析 `main.tsx`，识别 `@/` 别名和相对导入
- Python 解析器成功解析 `api_server.py`，提取 140 个节点/139 条边

### Phase 2: 核心功能（Week 2） ✅ 已完成

| 任务 | 状态 | 交付物 | 验收结果 |
|------|------|--------|----------|
| 实现 query/path/explain 解析器 | ✅ | `tools/shared/graph_query_engine.py` | 6 种意图：`path`, `neighbors`, `explain`, `community`, `calls`, `called_by`, `query`；模糊匹配支持大小写/部分匹配 |
| 实现图遍历引擎 | ✅ | `tools/graph_query.py` | CLI 可用：`path`, `neighbors`, `explain`, `community`, `calls`, `called_by`, `query` |
| API 端点接入 | ✅ | `api_server.py` 新增 4 个端点 | `/api/graph/query` (POST), `/api/graph/export` (POST), `/api/graph/stats` (GET), `/api/graph/node/{node_id:path}` (GET) — TestClient 全部 200 |
| 导出模块（GraphML/Neo4j） | ✅ | `tools/shared/graph_export.py` | GraphML/CSV/Cypher 三种格式全部导出成功；GraphML 可用 Gephi/Cytoscape 打开 |

**Phase 2 运行结果：**
- CLI: `python tools/graph_query.py "explain code/tools/api_server"` 正确输出 139 度中心性
- API TestClient: 4 个端点全部 200 OK
- 导出: `graph.graphml` (NetworkX), `graph_nodes.csv` + `graph_edges.csv`, `graph.cypher` (4880 行)

### Phase 3: 自动化（Week 3） ✅ 已完成

| 任务 | 状态 | 交付物 | 验收结果 |
|------|------|--------|----------|
| Git Hook 安装脚本 | ✅ | `tools/graphify_hooks.py` | `install`/`uninstall`/`status` 全部可用；post-commit/post-checkout/post-merge 自动重建图谱 |
| Watch Mode 增量更新 | ✅ | `watcher.py` 更新 | `--graph` 参数可用；监视 `tools/` + `wiki-viewer/src/` + `raw/`；10s debounce 自动触发 `build_graph.py --incremental` |
| 增量图谱算法 | ✅ | `tools/build_graph.py --incremental` | 全量 ~1.2s → 增量 ~0.6s（无变化时仅 0.6s）；仅重新解析 hash 变化的代码文件 |

**Phase 3 运行结果：**
- Git hooks: `python tools/graphify_hooks.py install` → 3 个 hook 安装成功
- Watcher: `python tools/watcher.py --graph --once` → 正确扫描 200+ 代码文件并 schedule rebuild
- 增量构建: 修改 `api_server.py` 后 `build_graph.py --incremental` → 0.6s 完成，仅重新解析变化文件
- `.cache.json` 中新增 `_code_hashes` 字段，持久化代码文件 hash

### Phase 4: 验证与文档（Week 4） ✅ 已完成

| 任务 | 状态 | 交付物 | 验收结果 |
|------|------|--------|----------|
| 端到端测试 | ✅ | `tests/test_graph_integration.py` | **23/23 测试通过**（pytest 5.66s） |
| 性能基准 | ✅ | `docs/benchmarks/graph-perf.md` | 社区检测 ~80ms（Louvain）/ ~120ms（Leiden）；全量构建 ~1.2s；增量 ~0.6s |
| 用户文档 | ✅ | `docs/graphify-integration-guide.md` | 覆盖 CLI、API、架构、故障排除 |

**Phase 4 测试覆盖：**
- `TestGraphExists`: graph.json 存在性、节点/边数量、code/wiki 节点、社区分配
- `TestGraphQueryEngine`: explain / neighbors / path / query / community / calls / called_by / fuzzy_match
- `TestGraphExport`: CSV / Cypher / GraphML 三种格式导出
- `TestBuildGraph`: --code / --leiden / --incremental 三种构建模式
- `TestAPIEndpoints`: /api/graph/stats / query / node / export 四个端点（TestClient）

---

## 五、技术栈与依赖

### 5.1 新增依赖

```txt
# requirements.txt 新增

# Tree-sitter (code AST parsing)
tree-sitter>=0.23.0
tree-sitter-python>=0.23.0
tree-sitter-typescript>=0.23.0
tree-sitter-javascript>=0.23.0
tree-sitter-go>=0.23.0

# Leiden community detection
python-igraph>=0.11.0
leidenalg>=0.10.0

# Graph export
networkx[all]>=3.6.0  # 已有，确认版本
```

### 5.2 可选依赖

```txt
# Neo4j export
neo4j>=5.0.0

# Obsidian vault export
pyyaml>=6.0  # 已有
```

---

## 六、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| tree-sitter Windows 编译失败 | 中 | 高 | 使用预编译 wheel，fallback 到现有 ast/regex |
| Leiden 算法结果不稳定 | 低 | 中 | 固定 seed，提供 Louvain fallback |
| 代码图谱节点过多导致 vis.js 卡顿 | 中 | 中 | 添加层级折叠（package-level → file-level → func-level） |
| 自然语言查询理解不准确 | 中 | 低 | 从规则解析开始，逐步引入轻量 LLM |
| 增量图谱更新引入不一致边 | 低 | 高 | 每次增量更新后运行一致性检查 |

---

## 七、与现有系统的兼容性

| 现有系统 | 影响 | 兼容性策略 |
----------|------|-----------|
| `build_graph.py` | 修改社区检测调用 | 保留 `--no-infer` 等所有现有参数 |
| `api_server.py` | 新增 4 个端点 | 不影响现有端点 |
| `pg_search_backend.py` | 无影响 | 独立运行 |
| `wiki-viewer` | 需支持 code 节点渲染 | vis.js 配置向后兼容 |
| `skills/` | 无影响 | knowledge-graph skill 触发词不变 |
