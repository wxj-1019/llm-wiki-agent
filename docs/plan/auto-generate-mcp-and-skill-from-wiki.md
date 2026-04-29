# 从 Wiki 知识库自动生成 MCP Server 与 Kimi Skill 实现方案

> **版本**: v1.2  
> **日期**: 2026-04-29（初版），同日评审更新并整合优化  
> **目标**: 将 `wiki/` 中的结构化知识自动转化为 Agent 可直接消费的两种资产——MCP Server 与 Kimi Skill。  
> **变更说明**: v1.2 已将第 10 章《架构优化建议》中的合理项（增量更新、中文分词、O(n) 消除、pre-flight 校验、graph 异常降级、压缩比调整、性能基准修正）反向整合到前序章节的设计方案中。

---

## 目录

1. [方案总览](#一方案总览)
2. [MCP Server 生成方案](#二mcp-server-生成方案)
3. [Kimi Skill 生成方案](#三kimi-skill-生成方案)
4. [自动化流水线设计](#四自动化流水线设计)
5. [详细实施步骤](#五详细实施步骤)
6. [两种形态对比与选择](#六两种形态对比与选择)
7. [风险与应对](#七风险与应对)
8. [附录](#八附录)
9. [新增功能对比](#九新增功能对比)
10. [架构优化建议](#十架构优化建议)

---

## 一、方案总览

### 1.1 核心目标

将 `wiki/` 目录中由 AI Agent 维护的 markdown 知识库（含 YAML frontmatter、`[[wikilinks]]`、知识图谱），通过自动化流水线转化为两类 Agent 可用资产：

| 资产类型 | 消费端 | 核心价值 | 技术形态 |
|---------|--------|---------|---------|
| **MCP Server** | Claude Desktop、Cursor、Kimi CLI、VS Code | Agent 通过 Tools/Resources 实时查询知识库 | Python `FastMCP` 进程 |
| **Kimi Skill** | Kimi CLI (`/skill` 加载) | 将领域知识注入上下文，形成领域专家模式 | `.skill` 文件（zip 包） |

### 1.2 架构设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              输入层 (Input)                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ wiki/*.md   │  │ graph.json  │  │ index.md    │  │ agent-kit-config.yaml│ │
│  │ (markdown)  │  │ (图谱数据)   │  │ (索引目录)   │  │ (生成配置)           │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼────────────────┼────────────────────┼────────────┘
          │                │                │                    │
          ▼                ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            处理层 (Pipeline)                                  │
│                         tools/export_agent_kit.py                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ 1. Wiki Parser  │  │ 2. Index Builder│  │ 3. Graph Analyzer           │  │
│  │    - 遍历 md    │  │    - 倒排索引    │  │    - 节点中心性计算          │  │
│  │    - 提取 YAML  │  │    - 标签聚合    │  │    - 社区发现               │  │
│  │    - 解析链接   │  │    - 路径映射    │  │    - 关系网提取             │  │
│  └────────┬────────┘  └────────┬────────┘  └─────────────┬─────────────────┘  │
│           │                    │                         │                    │
│           ▼                    ▼                         ▼                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 4. Content Triage (内容分级)                                          │   │
│  │    P0: overview + 高频实体/概念（进入 Skill 核心 + MCP Prompts）       │   │
│  │    P1: 其余完整页面（进入 MCP Resources + Skill references）           │   │
│  │    P2: stub 页面（< 300 字符，过滤掉）                                 │   │
│  └────────────────────────────┬─────────────────────────────────────────┘   │
│                               │                                              │
│           ┌───────────────────┼───────────────────┐                          │
│           ▼                   ▼                   ▼                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ 5a. MCP Gen  │    │ 5b. Skill Gen│    │ 5c. LLM Opt  │                   │
│  │    生成 Server│    │    生成 Skill │    │    优化描述   │                   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                   │
└─────────┼───────────────────┼───────────────────┼───────────────────────────┘
          ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              输出层 (Output)                                  │
│  ┌────────────────────────────┐  ┌────────────────────────────────────────┐  │
│  │ agent-kit/mcp-server/      │  │ agent-kit/skills/                      │  │
│  │ ├── wiki_mcp_server.py     │  │ ├── llm-wiki-knowledge/                │  │
│  │ ├── wiki_index.py          │  │ │   ├── SKILL.md                       │  │
│  │ ├── graph_client.py        │  │ │   └── references/                    │  │
│  │ ├── prompts/               │  │ ├── paper-reading/                     │  │
│  │ └── README.md              │  │ └── *.skill (zip)                      │  │
│  └────────────────────────────┘  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 与现有工作流的集成

```
ingest.py (摄入新文档)
    │
    ▼
┌─────────────────┐
│ 更新 wiki/*.md  │
│ 更新 graph.json │
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│ export_agent_kit.py      │  <-- 新增：在 ingest 成功后自动触发
│ (增量更新 MCP + Skill)   │
└──────────────────────────┘
```

---

## 二、MCP Server 生成方案

### 2.1 MCP 核心概念映射

MCP (Model Context Protocol) 定义三种能力类型。我们将 wiki 内容映射如下：

#### Resources（文件型数据）

每个 wiki 页面注册为一个 Resource，URI 方案为 `wiki://{type}/{slug}`：

| Wiki 页面 | MCP Resource URI | MIME 类型 |
|-----------|-----------------|-----------|
| `wiki/overview.md` | `wiki://overview` | `text/markdown` |
| `wiki/entities/OpenAI.md` | `wiki://entities/OpenAI` | `text/markdown` |
| `wiki/concepts/Transformer.md` | `wiki://concepts/Transformer` | `text/markdown` |
| `wiki/sources/attention-is-all-you-need.md` | `wiki://sources/attention-is-all-you-need` | `text/markdown` |

**Resource 描述**自动从 YAML frontmatter 的 `title` 字段提取，帮助 LLM 理解何时读取该资源。

#### Tools（LLM 可调用的函数）

基于 wiki 结构生成以下工具：

| Tool 名称 | 输入参数 | 返回值 | 功能描述 |
|-----------|---------|--------|---------|
| `search_wiki` | `query: str`, `limit: int = 5` | `list[{title, path, excerpt, score}]` | 全文搜索 wiki 页面 |
| `get_page` | `path: str` | `str` | 读取指定页面原始 markdown |
| `get_entity` | `name: str` | `str` | 获取实体页面内容 |
| `get_concept` | `name: str` | `str` | 获取概念页面内容 |
| `list_sources` | `tag: str = "all"` | `list[{title, path, date}]` | 列出来源文档 |
| `get_overview` | 无 | `str` | 获取全局 living synthesis |
| `find_connections` | `topic: str`, `depth: int = 1` | `list[{node, relation, target}]` | 基于图谱查找关联 |
| `ask_wiki` | `question: str` | `str` | RAG 问答：检索 → 合成 |

#### Prompts（预写任务模板）

| Prompt 名称 | 参数 | 用途 |
|------------|------|------|
| `summarize_topic` | `topic: str` | 引导 Agent 搜索并总结某主题 |
| `compare_entities` | `a: str, b: str` | 引导 Agent 对比两个实体 |
| `trace_evolution` | `concept: str` | 引导 Agent 追踪某概念的发展脉络 |
| `find_contradictions` | `topic: str = "all"` | 引导 Agent 发现知识库中的矛盾点 |

### 2.2 生成的 MCP Server 目录结构

```
agent-kit/mcp-server/
├── wiki_mcp_server.py          # 主入口（FastMCP），由模板生成
├── wiki_index.py               # 预构建索引：标题→路径、标签→页面列表
├── graph_client.py             # 封装 graph.json 的查询逻辑
├── prompts/
│   ├── summarize_topic.txt     # Prompt 模板
│   ├── compare_entities.txt
│   ├── trace_evolution.txt
│   └── find_contradictions.txt
├── README.md                   # 使用说明与配置指南
└── pyproject.toml              # 独立运行时的依赖
```

### 2.3 核心代码设计

#### 2.3.1 Server 主文件（模板生成）

```python
# wiki_mcp_server.py (自动生成，基于模板)
from pathlib import Path
from mcp.server.fastmcp import FastMCP
import json
import logging

# ── 配置 ──
WIKI_ROOT = Path(__file__).parent.parent.parent / "wiki"
GRAPH_PATH = Path(__file__).parent.parent.parent / "graph" / "graph.json"
INDEX_PATH = Path(__file__).parent / "wiki_index.py"

# STDIO 服务器禁止 stdout 输出
logging.basicConfig(level=logging.INFO, stream=logging.StreamHandler())
logger = logging.getLogger("wiki-mcp")

mcp = FastMCP("llm-wiki")

# ── 辅助函数 ──
def read_wiki_page(rel_path: str) -> str:
    """安全读取 wiki 页面内容。"""
    target = (WIKI_ROOT / rel_path).resolve()
    # 路径遍历保护：确保目标在 WIKI_ROOT 内
    if not str(target).startswith(str(WIKI_ROOT.resolve())):
        return "Error: Invalid path (path traversal detected)"
    if not target.exists():
        return f"Error: Page not found: {rel_path}"
    return target.read_text(encoding="utf-8")

def load_graph() -> dict:
    """加载知识图谱数据。"""
    if not GRAPH_PATH.exists():
        return {"nodes": [], "edges": []}
    return json.loads(GRAPH_PATH.read_text(encoding="utf-8"))

# ── Resources ──
# 动态注册所有 wiki 页面为 Resources
# （实际生成时，由模板遍历所有页面生成）

@mcp.resource("wiki://overview")
def resource_overview() -> str:
    """Living synthesis across all sources in the wiki."""
    return read_wiki_page("overview.md")

@mcp.resource("wiki://index")
def resource_index() -> str:
    """Catalog of all pages in the wiki."""
    return read_wiki_page("index.md")

# ... 其他页面由模板自动生成 ...

# ── Tools ──

@mcp.tool()
def search_wiki(query: str, limit: int = 5) -> list[dict]:
    """Search wiki pages by keyword.

    Args:
        query: Search keyword or phrase
        limit: Maximum number of results (default: 5)

    Returns:
        List of matching pages with title, path, excerpt, and relevance score.
    """
    # 使用预构建的倒排索引进行搜索
    from wiki_index import search_index
    return search_index(query, limit)

@mcp.tool()
def get_page(path: str) -> str:
    """Read a specific wiki page by relative path.

    Args:
        path: Relative path within wiki/ (e.g., 'entities/OpenAI.md')

    Returns:
        Full markdown content of the page.
    """
    return read_wiki_page(path)

@mcp.tool()
def get_overview() -> str:
    """Get the living synthesis of the entire wiki knowledge base.

    Use this when you need a high-level understanding of what the wiki covers.
    """
    return read_wiki_page("overview.md")

@mcp.tool()
def find_connections(topic: str, depth: int = 1) -> list[dict]:
    """Find pages connected to a topic via wikilinks or graph edges.

    Args:
        topic: The topic/node name to start from (e.g., 'Transformer', 'OpenAI')
        depth: How many hops to traverse (default: 1, max: 3)

    Returns:
        List of connections: {source, relation, target, confidence}
    """
    graph = load_graph()
    # BFS 遍历图谱
    results = []
    # ... 实现 BFS ...
    return results

@mcp.tool()
def list_sources(tag: str = "all") -> list[dict]:
    """List all source documents in the wiki.

    Args:
        tag: Filter by tag (default 'all' returns everything)

    Returns:
        List of sources with title, path, date, and tags.
    """
    from wiki_index import get_sources
    return get_sources(tag)

@mcp.tool()
def ask_wiki(question: str) -> str:
    """Ask a question and get an answer synthesized from the wiki.

    This tool performs retrieval-augmented generation:
    1. Searches for relevant pages
    2. Retrieves their content
    3. Synthesizes an answer with inline citations

    Args:
        question: The question to answer

    Returns:
        Synthesized answer with [[PageName]] citations.
    """
    # 步骤 1: 搜索相关页面
    relevant = search_wiki(question, limit=3)
    if not relevant:
        return "No relevant information found in the wiki."

    # 步骤 2: 检索内容
    contexts = []
    for page in relevant:
        content = read_wiki_page(page["path"])
        contexts.append(f"## {page['title']}\n{content[:2000]}...")

    # 步骤 3: 返回结构化上下文（由 LLM 自行合成）
    # 注意：MCP Tool 本身不做 LLM 调用，而是提供足够上下文
    return "\n\n---\n\n".join(contexts)

# ── Prompts ──

@mcp.prompt()
def summarize_topic(topic: str) -> str:
    """Generate a structured summary of a topic from the wiki."""
    return f"""Research the topic "{topic}" using the wiki knowledge base.

Steps:
1. Use search_wiki("{topic}") to find relevant pages
2. Use get_page() to read the top 2-3 most relevant pages
3. Synthesize a structured summary covering:
   - Core definition
   - Key claims or findings
   - Related entities and concepts
   - Connections to other topics (use find_connections if needed)

Format your response with clear headings and inline citations like [[PageName]]."""

@mcp.prompt()
def compare_entities(a: str, b: str) -> str:
    """Compare two entities from the wiki knowledge base."""
    return f"""Compare "{a}" and "{b}" based on the wiki knowledge base.

Steps:
1. Use get_entity("{a}") and get_entity("{b}") (or search_wiki if exact names unknown)
2. Compare across these dimensions:
   - Background / founding context
   - Key contributions or products
   - Relationships to other entities/concepts
   - Timeline of major events
3. Note any contradictions or competing narratives in the wiki.

Format as a structured comparison table followed by narrative analysis."""

@mcp.prompt()
def trace_evolution(concept: str) -> str:
    """Trace the evolution of a concept through the wiki sources."""
    return f"""Trace how the concept "{concept}" evolved according to the wiki.

Steps:
1. search_wiki("{concept}") to find all mentions
2. Prioritize source pages (wiki/sources/*) for chronological evidence
3. Identify key milestones and who contributed what
4. Note paradigm shifts or contradictions over time"""

# ── 入口 ──
if __name__ == "__main__":
    mcp.run(transport="stdio")
```

#### 2.3.2 索引模块（wiki_index.py）

```python
# wiki_index.py (自动生成)
"""Pre-built index for fast wiki queries."""
from pathlib import Path

WIKI_ROOT = Path(__file__).parent.parent.parent / "wiki"

# ── 页面索引 ──
PAGE_INDEX = {
    # slug -> {title, path, type, tags, summary}
    "OpenAI": {
        "title": "OpenAI",
        "path": "entities/OpenAI.md",
        "type": "entity",
        "tags": ["company", "ai", "research"],
        "summary": "AI research laboratory; created ChatGPT, GPT-4, DALL-E"
    },
    "Transformer": {
        "title": "Transformer",
        "path": "concepts/Transformer.md",
        "type": "concept",
        "tags": ["architecture", "nlp", "deep-learning"],
        "summary": "Deep learning architecture based solely on attention mechanisms"
    },
    # ... 由生成器遍历 wiki 自动填充 ...
}

# ── 标签索引 ──
TAG_INDEX = {
    "company": ["OpenAI", "Google"],
    "architecture": ["Transformer", "AttentionMechanism"],
    # ...
}

# ── 分词（支持中英文，零外部依赖） ──
def _tokenize(text: str) -> set[str]:
    """轻量分词：英文单词 + 中文 bigram。无需 jieba 等依赖。"""
    tokens = set()
    # 英文词（≥3 字母）
    tokens.update(re.findall(r'\b[a-z]{3,}\b', text.lower()))
    # 中文 bigram
    for segment in re.findall(r'[\u4e00-\u9fff]+', text):
        for i in range(len(segment) - 1):
            tokens.add(segment[i:i+2])
    return tokens

# ── 倒排索引 (keyword -> [slugs]) ──
# 构建时已将 title、body 分词统一纳入，search 时无需 O(n) 回退扫描
INVERTED_INDEX = {
    "transformer": ["Transformer", "attention-is-all-you-need"],
    "attention": ["AttentionMechanism", "Transformer", "Bahdanau"],
    "openai": ["OpenAI", "SamAltman", "GregBrockman", "IlyaSutskever"],
    # ... 由生成器自动构建 ...
}

def search_index(query: str, limit: int = 5) -> list[dict]:
    """纯倒排索引搜索，O(k) 复杂度，k = 匹配词条数。"""
    query_words = _tokenize(query)
    scores = {}
    for word in query_words:
        for slug in INVERTED_INDEX.get(word, []):
            scores[slug] = scores.get(slug, 0) + 1
    sorted_slugs = sorted(scores.keys(), key=lambda s: scores[s], reverse=True)[:limit]
    return [{
        "title": PAGE_INDEX[s]["title"],
        "path": PAGE_INDEX[s]["path"],
        "type": PAGE_INDEX[s]["type"],
        "excerpt": PAGE_INDEX[s]["summary"],
        "score": scores[s]
    } for s in sorted_slugs]

def get_sources(tag: str = "all") -> list[dict]:
    """列出所有来源文档。"""
    sources = [p for p in PAGE_INDEX.values() if p["type"] == "source"]
    if tag != "all":
        sources = [s for s in sources if tag in s.get("tags", [])]
    return sources

def get_entity(name: str) -> dict | None:
    """获取实体信息。"""
    # 支持模糊匹配
    name_lower = name.lower()
    for slug, info in PAGE_INDEX.items():
        if info["type"] == "entity" and name_lower in slug.lower():
            return info
    return None

def get_concept(name: str) -> dict | None:
    """获取概念信息。"""
    name_lower = name.lower()
    for slug, info in PAGE_INDEX.items():
        if info["type"] == "concept" and name_lower in slug.lower():
            return info
    return None
```

#### 2.3.3 图谱客户端（graph_client.py）

```python
# graph_client.py
"""Knowledge graph query client."""
import json
from pathlib import Path
from collections import defaultdict, deque

GRAPH_PATH = Path(__file__).parent.parent.parent / "graph" / "graph.json"

class GraphClient:
    def __init__(self):
        self._graph = None
        self._adj = None

    def _load(self):
        if self._graph is not None:
            return
        if not GRAPH_PATH.exists():
            self._graph = {"nodes": [], "edges": []}
        else:
            self._graph = json.loads(GRAPH_PATH.read_text(encoding="utf-8"))

        # 构建邻接表
        self._adj = defaultdict(list)
        for edge in self._graph.get("edges", []):
            src = edge.get("source")
            tgt = edge.get("target")
            if src and tgt:
                self._adj[src].append({
                    "target": tgt,
                    "relation": edge.get("relation", "related"),
                    "confidence": edge.get("confidence", 1.0),
                    "type": edge.get("type", "explicit")
                })

    def find_neighbors(self, node: str, depth: int = 1) -> list[dict]:
        """BFS 查找邻居节点。"""
        self._load()
        visited = {node}
        queue = deque([(node, 0)])
        results = []

        while queue:
            current, d = queue.popleft()
            if d >= depth:
                continue
            for edge in self._adj.get(current, []):
                target = edge["target"]
                if target not in visited:
                    visited.add(target)
                    queue.append((target, d + 1))
                    results.append({
                        "source": current,
                        "target": target,
                        "relation": edge["relation"],
                        "confidence": edge["confidence"],
                        "hops": d + 1
                    })
        return results

    def get_centrality(self, top_n: int = 10) -> list[dict]:
        """返回度中心性最高的节点（可用于 Skill 实体精选）。"""
        self._load()
        degrees = defaultdict(int)
        for edge in self._graph.get("edges", []):
            degrees[edge.get("source", "")] += 1
            degrees[edge.get("target", "")] += 1

        sorted_nodes = sorted(degrees.items(), key=lambda x: x[1], reverse=True)
        return [{"node": n, "degree": d} for n, d in sorted_nodes[:top_n] if n]

    def find_path(self, start: str, end: str, max_depth: int = 4) -> list[dict]:
        """查找两个节点之间的路径。"""
        self._load()
        queue = deque([(start, [])])
        visited = {start}

        while queue:
            current, path = queue.popleft()
            if len(path) >= max_depth:
                continue
            for edge in self._adj.get(current, []):
                target = edge["target"]
                new_path = path + [{"from": current, "to": target, **edge}]
                if target == end:
                    return new_path
                if target not in visited:
                    visited.add(target)
                    queue.append((target, new_path))
        return []
```

### 2.4 客户端配置示例

生成后，用户只需在支持 MCP 的客户端中添加配置：

#### Claude Desktop (macOS)

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "llm-wiki": {
      "command": "uv",
      "args": [
        "--directory",
        "/ABSOLUTE/PATH/TO/llm-wiki-agent",
        "run",
        "agent-kit/mcp-server/wiki_mcp_server.py"
      ]
    }
  }
}
```

#### Cursor / VS Code

在 Settings 的 MCP 配置中添加相同内容。

#### Kimi CLI (未来支持 MCP 时)

在 `~/.kimi/mcp.json` 中注册：

```json
{
  "mcpServers": {
    "llm-wiki": {
      "command": "python",
      "args": ["agent-kit/mcp-server/wiki_mcp_server.py"]
    }
  }
}
```

---

## 三、Kimi Skill 生成方案

### 3.1 Skill 设计原则

Kimi Skill 是**静态知识注入**，与 MCP 的**动态查询**形成互补：

- **Skill 提供领域框架**：让 Kimi 知道"这个领域有哪些关键概念和关系"
- **MCP 提供事实查证**：当需要具体细节时，调用 Tool 查询最新 wiki 内容
- **最佳实践**：Skill 存"知道什么"，MCP 存"查什么"

### 3.2 从 Wiki 映射到 Skill 结构

#### SKILL.md（核心文件，自动生成）

```markdown
---
name: llm-wiki-knowledge
description: |
  提供关于大型语言模型、Transformer 架构和相关 AI 领域知识的深度支持。
  涵盖 OpenAI、Google、注意力机制、GPT/BERT/T5 等核心概念。
  使用场景：
  (1) 回答 AI/LLM 领域专业问题
  (2) 解释技术概念和架构原理
  (3) 对比不同模型或公司
  (4) 梳理技术发展脉络和时间线
  (5) 识别知识库中的矛盾和开放问题
---

# LLM Wiki Knowledge

## 领域概览

本知识库聚焦 Transformer 时代的大型语言模型生态，包含 2 篇核心文献、7 个关键实体和 2 个基础概念。

### 核心主题
1. **Transformer 架构** — 2017 年由 Google 提出，用自注意力替代循环，实现并行训练
2. **注意力机制** — Scaled dot-product attention、Multi-head attention 及其变体
3. **Scaling Laws** — 模型能力随计算量、数据量、参数量的可预测增长
4. **LLM 生态** — Decoder-only (GPT)、Encoder-only (BERT)、Encoder-decoder (T5) 的竞争格局

## 核心实体（Top Entities）

| 实体 | 类型 | 一句话描述 |
|------|------|-----------|
| **OpenAI** | 公司 | AI 研究实验室；创建了 ChatGPT、GPT-4、DALL-E |
| **Google** | 公司 | Transformer 架构的发明者；BERT、T5 的提出者 |
| **Sam Altman** | 人物 | OpenAI CEO |
| **Ilya Sutskever** | 人物 | OpenAI 联合创始人、前首席科学家 |
| **Greg Brockman** | 人物 | OpenAI 联合创始人、前 CTO |
| **Vaswani** | 人物 | "Attention Is All You Need" 第一作者 |
| **Bahdanau** | 人物 | 最早将注意力机制引入 RNN 的研究者 |

## 核心概念（Top Concepts）

### Transformer
- **定义**: 基于纯注意力机制的深度学习架构，无需循环或卷积
- **关键创新**: 用自注意力替代 RNN，实现序列位置的并行计算
- **架构组件**:
  - Encoder: Multi-head self-attention + FFN + LayerNorm
  - Decoder: Masked self-attention + Cross-attention + FFN
- **主要变体**:
  - Encoder-only: BERT, RoBERTa, DistilBERT
  - Decoder-only: GPT 系列, LLaMA, Claude
  - Encoder-decoder: T5, BART, UL2
- **引用**: [[Attention Is All You Need]], [[Transformer]]

### Attention Mechanism
- **定义**: 神经网络聚焦输入特定部分的技术
- **关键形式**:
  - Scaled dot-product attention (Transformer 核心)
  - Multi-head attention (并行多视角)
  - Causal/masked attention (自回归解码)
- **发展脉络**: Bahdanau (RNN+Attention, 2015) → Vaswani (Attention-only, 2017)
- **引用**: [[AttentionMechanism]], [[Bahdanau]], [[Vaswani]]

## 关键关系网络

```
Transformer (Google, 2017)
    ├── 被 OpenAI 规模化 → GPT 系列
    ├── 被 Google 扩展 → BERT, T5
    ├── 核心机制 → Attention Mechanism
    └── 首作者 → Vaswani

Bahdanau (2015) ──→ Attention for RNNs
    └── Transformer (2017) ──→ Attention alone is sufficient
```

## 时间线

- **2015**: Bahdanau 提出 RNN + Attention
- **2017-06**: Vaswani et al. 发布 "Attention Is All You Need" (Google)
- **2018**: OpenAI 发布 GPT-1
- **2019**: OpenAI 发布 GPT-2
- **2020**: OpenAI 发布 GPT-3
- **2022-11**: OpenAI 发布 ChatGPT
- **2023**: OpenAI 发布 GPT-4

## 矛盾与开放问题

1. **涌现能力本质**: 是 LLM 的根本属性，还是评估指标的 artifacts？
2. **注意力 vs 循环**: Bahdanau 证明 RNN 需要注意力；Vaswani 证明注意力不需要 RNN
3. **开源 vs 闭源**: 开放权重模型（LLaMA）与 API-only 模型（GPT-4）的竞争格局

## 知识缺口（Wiki 待补充）

- RLHF 相关来源
- 多模态模型（GPT-4V, Gemini）
- 开源 LLM 生态（LLaMA, Mistral, Qwen）

## 使用工作流

当用户询问相关主题时：

1. **识别问题范围**: 是概念解释、实体对比、还是技术脉络？
2. **引用核心知识**: 优先使用上述"核心实体"和"核心概念"中的信息
3. **补充细节**: 如需更详细资料，建议用户查询 wiki 的特定页面
4. **标注不确定性**: 如果信息来自"矛盾与开放问题"部分，明确标注争议性
5. **建议扩展**: 如果问题涉及"知识缺口"中的领域，告知用户 wiki 尚未覆盖
```

### 3.3 生成策略详解

#### 3.3.1 内容分级（Content Triage）

| 优先级 | 来源 | 处理方式 | 进入位置 |
|--------|------|---------|---------|
| **P0** | `overview.md` 的 Key Themes | 直接提取为 Skill 的"核心主题" | Skill body 开头 |
| **P0** | 图谱度中心性 Top N 实体 | 一句话描述 + 关键属性 | "核心实体"表格 |
| **P0** | 图谱度中心性 Top N 概念 | 定义 + 关键要点 + 变体 | "核心概念"章节 |
| **P1** | 其余完整页面 (> 500 字符) | 压缩为摘要 | `references/` 目录 |
| **P2** | Stub 页面 (< 300 字符) | **过滤丢弃** | 不进入 Skill |

#### 3.3.2 实体/概念精选算法

```python
def select_top_nodes(graph, wiki_pages, max_entities=10, max_concepts=10):
    """基于多维度评分选择最重要的节点进入 Skill。"""
    scores = {}

    for node in graph["nodes"]:
        slug = node["id"]
        score = 0

        # 维度 1: 图谱度中心性（连接数）
        degree = node.get("degree", 0)
        score += degree * 2

        # 维度 2: 页面质量（长度）
        page = wiki_pages.get(slug)
        if page:
            body_len = len(page["body"])
            if body_len < 300:
                continue  # 过滤 stub
            score += min(body_len / 1000, 5)  # 最长页面得 5 分

        # 维度 3: 类型权重
        node_type = node.get("type", "")
        if node_type == "concept":
            score *= 1.2  # 概念略优先

        # 维度 4: 跨社区连接（桥梁节点）
        betweenness = node.get("betweenness", 0)
        score += betweenness * 3

        scores[slug] = score

    # 按类型分组取 Top N
    entities = [s for s, n in graph["nodes"].items()
                if n.get("type") == "entity"]
    concepts = [s for s, n in graph["nodes"].items()
                if n.get("type") == "concept"]

    top_entities = sorted(entities, key=lambda s: scores.get(s, 0),
                          reverse=True)[:max_entities]
    top_concepts = sorted(concepts, key=lambda s: scores.get(s, 0),
                          reverse=True)[:max_concepts]

    return top_entities, top_concepts
```

#### 3.3.3 多 Skill 拆分策略

当 wiki 覆盖多个领域时，自动生成多个 Skill：

```yaml
# agent-kit-config.yaml 中的拆分配置
skill_splits:
  - name: llm-foundations
    description: "Transformer 架构、注意力机制、大语言模型基础概念"
    filter:
      types: [concept, entity]
      tags_include: [architecture, nlp, deep-learning]
    max_items: 20

  - name: paper-reading
    description: "核心论文解读与研究方法"
    filter:
      types: [source]
      tags_include: [paper]
    max_items: 15

  - name: industry-landscape
    description: "AI 公司与产业格局"
    filter:
      types: [entity]
      tags_include: [company]
    max_items: 10

  - name: full-wiki
    description: "完整知识库（大上下文模式）"
    filter:
      min_length: 300
    max_items: 50
```

### 3.4 Skill 目录结构

```
agent-kit/skills/
├── llm-wiki-knowledge/              # 主 Skill（领域综合）
│   ├── SKILL.md                     # 核心指令文件
│   └── references/                  # 可选：详细参考资料
│       ├── transformer-deep-dive.md
│       ├── openai-profile.md
│       └── attention-explained.md
│
├── llm-foundations.skill            # 打包后的分发文件 (zip)
├── paper-reading.skill
└── full-wiki.skill
```

### 3.5 Skill 打包命令

```bash
# 打包单个 Skill
cd agent-kit/skills/llm-wiki-knowledge
zip -r ../llm-wiki-knowledge.skill .

# 或使用生成器自动打包
python tools/export_agent_kit.py --target skill --package
```

### 3.6 在 Kimi CLI 中使用

```bash
# 加载 Skill
/skill load agent-kit/skills/llm-wiki-knowledge.skill

# 现在 Kimi 具备了该领域的上下文知识
# 可以直接问："OpenAI 和 Google 在 LLM 领域的竞争格局如何？"
# Kimi 会引用 Skill 中的实体信息和关系网络进行回答
```

---

## 四、自动化流水线设计

### 4.1 核心工具：`tools/export_agent_kit.py`

这是整个方案的引擎，提供以下 CLI 接口：

```bash
# 生成 MCP Server
python tools/export_agent_kit.py --target mcp --output agent-kit/mcp-server/

# 生成 Kimi Skill
python tools/export_agent_kit.py --target skill --output agent-kit/skills/

# 生成全部
python tools/export_agent_kit.py --target all --output agent-kit/

# 增量更新（基于文件修改时间）
python tools/export_agent_kit.py --target all --incremental

# 带 LLM 优化（调用 API 优化描述和摘要）
python tools/export_agent_kit.py --target all --optimize

# 打包为可分发格式
python tools/export_agent_kit.py --target skill --package

# 使用自定义配置
python tools/export_agent_kit.py --config agent-kit-config.yaml
```

### 4.2 内部模块设计

```
tools/
├── export_agent_kit.py          # CLI 入口
├── agent_kit/
│   ├── __init__.py
│   ├── parser.py                # Wiki 页面解析器
│   ├── indexer.py               # 索引构建器
│   ├── graph_analyzer.py        # 图谱分析器
│   ├── triage.py                # 内容分级器
│   ├── mcp_generator.py         # MCP Server 生成器
│   ├── skill_generator.py       # Skill 生成器
│   └── templates/               # Jinja2 模板
│       ├── mcp_server.py.j2
│       ├── wiki_index.py.j2
│       ├── graph_client.py.j2
│       ├── skill.md.j2
│       └── prompts/
│           ├── summarize.txt
│           └── compare.txt
```

### 4.3 处理流程详解

```
┌──────────────────────────────────────────────────────────────────────┐
│ Step 1: 解析 Wiki (parser.py)                                        │
├──────────────────────────────────────────────────────────────────────┤
│ 输入: wiki/**/*.md                                                   │
│ 处理:                                                                 │
│   - 遍历所有 markdown 文件                                           │
│   - 用正则/frontmatter 解析器提取 YAML metadata                       │
│   - 提取正文内容（去掉 frontmatter）                                  │
│   - 用正则 `\[\[(.*?)\]\]` 提取所有 wikilinks                       │
│   - 计算正文长度（过滤 stub）                                         │
│ 输出: dict[slug] → {title, type, tags, body, links, frontmatter}    │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Step 2: 构建索引 (indexer.py)                                        │
├──────────────────────────────────────────────────────────────────────┤
│ 处理:                                                                 │
│   - 标题 → 路径映射                                                  │
│   - 标签 → 页面列表                                                  │
│   - 类型 → 页面列表 (source/entity/concept/synthesis)                │
│   - 倒排索引: 分词 → 页面 (简单空格分词 + 小写)                      │
│   - 页面摘要: 取正文前 200 字符或第一个段落                           │
│ 输出: wiki_index.py (可直接 import 的 Python 模块)                   │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Step 3: 图谱分析 (graph_analyzer.py)                                 │
├──────────────────────────────────────────────────────────────────────┤
│ 输入: graph/graph.json                                               │
│ 处理:                                                                 │
│   - 节点度中心性计算 (degree centrality)                             │
│   - 介数中心性计算 (betweenness centrality)                          │
│   - 社区发现 (Louvain / 如果 graph.json 已有社区数据则复用)           │
│   - 识别桥梁节点（跨社区连接）                                        │
│   - 识别孤立社区                                                      │
│ 输出: 增强的节点列表 (含 centrality 分数)                             │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Step 4: 内容分级 (triage.py)                                         │
├──────────────────────────────────────────────────────────────────────┤
│ 输入: parser 输出 + graph_analyzer 输出                              │
│ 处理:                                                                 │
│   - P0 标记: overview + 度中心性 Top N + 介数中心性 Top N             │
│   - P1 标记: 其余完整页面 (body_len >= 300)                          │
│   - P2 丢弃: stub 页面 (body_len < 300)                              │
│   - 关系提取: 从 wikilinks 构建 "实体A → 关系 → 实体B" 列表           │
│ 输出: triaged_pages: dict[priority] → list[page]                    │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌─────────────────────────────────┐ ┌─────────────────────────────────┐
│ Step 5a: MCP 生成               │ │ Step 5b: Skill 生成             │
│ (mcp_generator.py)              │ │ (skill_generator.py)            │
├─────────────────────────────────┤ ├─────────────────────────────────┤
│ 输入: triaged_pages + 配置       │ │ 输入: triaged_pages + 配置       │
│ 处理:                            │ │ 处理:                            │
│   - 渲染 wiki_mcp_server.py     │ │   - 渲染 SKILL.md (Jinja2)      │
│   - 渲染 wiki_index.py          │ │   - 复制 P1 页面到 references/   │
│   - 渲染 graph_client.py        │ │   - 生成关系网文本描述            │
│   - 复制 prompt 模板            │ │   - 生成时间线（从 sources 日期） │
│   - 生成 README.md              │ │   - 生成矛盾/开放问题列表         │
│ 输出: agent-kit/mcp-server/     │ │ 输出: agent-kit/skills/{name}/  │
└─────────────────────────────────┘ └─────────────────────────────────┘
```

### 4.4 集成到现有工作流

在 `tools/ingest.py` 的末尾添加钩子：

```python
# tools/ingest.py (修改)

def post_ingest_hooks():
    """Successful ingest completed — regenerate agent assets."""
    import subprocess
    import sys

    kit_script = Path(__file__).parent / "export_agent_kit.py"
    if not kit_script.exists():
        return

    logger.info("Regenerating agent kit (MCP + Skill)...")
    result = subprocess.run(
        [sys.executable, str(kit_script), "--target", "all", "--incremental"],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT
    )
    if result.returncode == 0:
        logger.info("Agent kit regenerated successfully.")
    else:
        logger.warning(f"Agent kit regeneration failed: {result.stderr}")

# 在 ingest 流程最后调用
post_ingest_hooks()
```

---

## 五、详细实施步骤

### Phase 1: 基础设施（Day 1-2）

#### 5.1.1 安装依赖

更新 `requirements.txt`：

```txt
# MCP SDK
mcp>=1.2.0

# 模板引擎
jinja2>=3.1.0

# 图谱分析 (如 graph.json 不含中心性数据)
networkx>=3.0

# 现有依赖已有
# PyYAML>=6.0
# markitdown[all]
# tqdm
```

#### 5.1.2 创建目录结构

```bash
# 创建输出目录
mkdir -p agent-kit/mcp-server
mkdir -p agent-kit/skills

# 创建工具目录
mkdir -p tools/agent_kit
mkdir -p tools/agent_kit/templates
mkdir -p tools/agent_kit/templates/prompts

# 创建文档目录（本文件位置）
mkdir -p docs/plan
```

#### 5.1.3 创建模板文件

将 2.3 节和 3.2 节的代码保存为 Jinja2 模板：

- `tools/agent_kit/templates/mcp_server.py.j2`
- `tools/agent_kit/templates/wiki_index.py.j2`
- `tools/agent_kit/templates/graph_client.py.j2`
- `tools/agent_kit/templates/skill.md.j2`

### Phase 2: 解析与索引模块（Day 3-4）

#### 5.2.1 实现 `parser.py`

```python
# tools/agent_kit/parser.py
"""Parse wiki markdown files into structured data."""
from pathlib import Path
import re
import yaml

FRONTMATTER_RE = re.compile(r'^---\s*\n(.*?)\n---\s*\n(.*)', re.DOTALL)
WIKILINK_RE = re.compile(r'\[\[(.*?)\]\]')

def parse_page(path: Path) -> dict | None:
    """Parse a single wiki page."""
    text = path.read_text(encoding="utf-8")
    match = FRONTMATTER_RE.match(text)

    if not match:
        return None

    frontmatter = yaml.safe_load(match.group(1)) or {}
    body = match.group(2).strip()

    # 提取 wikilinks
    links = WIKILINK_RE.findall(body)
    # 支持 [[Name|Display]] 格式
    clean_links = [l.split('|')[0].strip() for l in links]

    slug = path.stem
    rel_path = str(path.relative_to(path.parent.parent.parent))

    return {
        "slug": slug,
        "path": rel_path,
        "title": frontmatter.get("title", slug),
        "type": frontmatter.get("type", "page"),
        "tags": frontmatter.get("tags", []),
        "sources": frontmatter.get("sources", []),
        "last_updated": frontmatter.get("last_updated", ""),
        "date": frontmatter.get("date", ""),
        "body": body,
        "body_length": len(body),
        "links": list(set(clean_links)),
        "frontmatter": frontmatter,
    }

def parse_all_pages(wiki_root: Path) -> dict[str, dict]:
    """Parse all markdown files in the wiki."""
    pages = {}
    for md_file in wiki_root.rglob("*.md"):
        page = parse_page(md_file)
        if page:
            pages[page["slug"]] = page
    return pages
```

#### 5.2.2 实现 `indexer.py`（增量更新 + 中文分词）

```python
# tools/agent_kit/indexer.py
"""Build and incrementally update search index from parsed pages."""
from collections import defaultdict
import hashlib
import json
from pathlib import Path

CACHE_FILE = Path(__file__).parent.parent.parent / ".cache" / "agent-kit-cache.json"

def _tokenize(text: str) -> set[str]:
    """轻量分词：英文单词 + 中文 bigram（无需 jieba）。"""
    tokens = set()
    tokens.update(re.findall(r'\b[a-z]{3,}\b', text.lower()))
    for segment in re.findall(r'[\u4e00-\u9fff]+', text):
        for i in range(len(segment) - 1):
            tokens.add(segment[i:i+2])
    return tokens

def _compute_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]

def load_cache() -> dict[str, str]:
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    return {}

def save_cache(cache: dict[str, str]):
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")

def detect_changes(pages: dict, wiki_root: Path, cache: dict) -> tuple[set, set, set]:
    """返回 (新增, 修改, 删除) 的 slug 集合。"""
    current = {}
    for slug, page in pages.items():
        p = wiki_root / page["path"]
        current[slug] = _compute_hash(p) if p.exists() else ""
    added = set(current.keys()) - set(cache.keys())
    modified = {s for s in current if s in cache and current[s] != cache[s]}
    deleted = set(cache.keys()) - set(current.keys())
    return added, modified, deleted

def build_index(
    pages: dict[str, dict],
    existing_index: dict | None = None,
    changed_slugs: set[str] | None = None
) -> dict:
    """构建或增量更新索引。changed_slugs=None 时全量重建。"""
    if existing_index is None:
        existing_index = {
            "page_index": {},
            "inverted": defaultdict(list),
            "tag_index": defaultdict(list),
            "type_index": defaultdict(list),
        }

    index = {
        "page_index": existing_index["page_index"].copy(),
        "inverted": defaultdict(list, {k: list(v) for k, v in existing_index.get("inverted", {}).items()}),
        "tag_index": defaultdict(list, {k: list(v) for k, v in existing_index.get("tag_index", {}).items()}),
        "type_index": defaultdict(list, {k: list(v) for k, v in existing_index.get("type_index", {}).items()}),
    }

    slugs_to_process = changed_slugs if changed_slugs else set(pages.keys())

    for slug in slugs_to_process:
        # 移除旧条目
        for word, slugs in list(index["inverted"].items()):
            if slug in slugs:
                slugs.remove(slug)
                if not slugs:
                    del index["inverted"][word]
        for tag, slugs in list(index["tag_index"].items()):
            if slug in slugs:
                slugs.remove(slug)
        for typ, slugs in list(index["type_index"].items()):
            if slug in slugs:
                slugs.remove(slug)
        index["page_index"].pop(slug, None)

        if slug not in pages:
            continue  # 已删除

        page = pages[slug]
        index["page_index"][slug] = {
            "title": page["title"],
            "path": page["path"],
            "type": page["type"],
            "tags": page["tags"],
            "summary": page["body"][:200].replace('\n', ' ') + "...",
        }

        # 倒排索引：title + body 前 500 字符统一分词
        text = f"{page['title']} {page['body'][:500]}"
        for word in _tokenize(text):
            index["inverted"][word].append(slug)

        for tag in page.get("tags", []):
            index["tag_index"][tag].append(slug)
        index["type_index"][page["type"]].append(slug)

    return {
        "page_index": index["page_index"],
        "inverted": dict(index["inverted"]),
        "tag_index": dict(index["tag_index"]),
        "type_index": dict(index["type_index"]),
    }
```

### Phase 3: 生成器模块（Day 5-7）

#### 5.3.1 实现 `mcp_generator.py`

```python
# tools/agent_kit/mcp_generator.py
"""Generate MCP Server from wiki content."""
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

TEMPLATE_DIR = Path(__file__).parent / "templates"
env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))

def generate_mcp_server(pages, graph_data, config, output_dir: Path):
    """Generate all MCP server files."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. 生成 wiki_mcp_server.py
    template = env.get_template("mcp_server.py.j2")
    content = template.render(
        pages=pages,
        config=config,
    )
    (output_dir / "wiki_mcp_server.py").write_text(content, encoding="utf-8")

    # 2. 生成 wiki_index.py
    template = env.get_template("wiki_index.py.j2")
    content = template.render(
        pages=pages,
        index=build_index(pages),
    )
    (output_dir / "wiki_index.py").write_text(content, encoding="utf-8")

    # 3. 生成 graph_client.py
    template = env.get_template("graph_client.py.j2")
    content = template.render()
    (output_dir / "graph_client.py").write_text(content, encoding="utf-8")

    # 4. 复制 prompts
    prompts_dir = output_dir / "prompts"
    prompts_dir.mkdir(exist_ok=True)
    for prompt_file in (TEMPLATE_DIR / "prompts").glob("*.txt"):
        copy2(prompt_file, prompts_dir / prompt_file.name)

    # 5. 生成 README.md
    readme = generate_mcp_readme(config)
    (output_dir / "README.md").write_text(readme, encoding="utf-8")
```

#### 5.3.2 实现 `skill_generator.py`

```python
# tools/agent_kit/skill_generator.py
"""Generate Kimi Skill from wiki content."""
from pathlib import Path
from shutil import copy2

def generate_skill(pages, graph_analysis, config, output_dir: Path):
    """Generate Skill package."""
    skill_name = config.get("name", "wiki-knowledge")
    skill_dir = output_dir / skill_name
    skill_dir.mkdir(parents=True, exist_ok=True)

    # 1. 精选实体和概念
    top_entities = select_top_nodes(
        graph_analysis, pages,
        max_entities=config.get("max_entities", 10),
        node_type="entity"
    )
    top_concepts = select_top_nodes(
        graph_analysis, pages,
        max_concepts=config.get("max_concepts", 10),
        node_type="concept"
    )

    # 2. 生成 SKILL.md
    template = env.get_template("skill.md.j2")
    skill_md = template.render(
        skill_name=skill_name,
        skill_description=config.get("description", ""),
        overview=pages.get("overview", {}),
        entities=top_entities,
        concepts=top_concepts,
        pages=pages,
        config=config,
    )
    (skill_dir / "SKILL.md").write_text(skill_md, encoding="utf-8")

    # 3. 复制 references（P1 页面）
    if config.get("include_references", True):
        ref_dir = skill_dir / "references"
        ref_dir.mkdir(exist_ok=True)
        for slug, page in pages.items():
            if page["body_length"] >= config.get("page_min_length", 300):
                target = ref_dir / f"{slug}.md"
                target.write_text(
                    f"# {page['title']}\n\n{page['body']}",
                    encoding="utf-8"
                )

    return skill_dir
```

### Phase 4: CLI 入口与集成（Day 8）

#### 5.4.1 实现 `export_agent_kit.py`

```python
#!/usr/bin/env python3
"""Export wiki knowledge to MCP Server and/or Kimi Skill."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
WIKI_ROOT = REPO_ROOT / "wiki"
GRAPH_PATH = REPO_ROOT / "graph" / "graph.json"
DEFAULT_OUTPUT = REPO_ROOT / "agent-kit"


def load_graph(graph_path: Path) -> dict:
    """安全加载知识图谱，损坏时降级而非崩溃。"""
    if not graph_path.exists():
        print("⚠️  graph.json not found — graph-based features disabled")
        return {"nodes": [], "edges": []}
    try:
        data = json.loads(graph_path.read_text(encoding="utf-8"))
        if "nodes" not in data or "edges" not in data:
            raise ValueError("Missing required keys: 'nodes' or 'edges'")
        return data
    except (json.JSONDecodeError, ValueError) as e:
        print(f"⚠️  graph.json is corrupted ({e}) — graph-based features disabled")
        print("   Run 'python tools/build_graph.py' to regenerate.")
        return {"nodes": [], "edges": []}


def run_preflight_check(pages: dict) -> dict:
    """轻量前置检查（不依赖 LLM，仅做结构性校验）。"""
    critical = []
    warnings = []

    if len(pages) == 0:
        critical.append("wiki/ contains no markdown files")
    elif len(pages) < 5:
        warnings.append(f"wiki/ has only {len(pages)} pages — Skill will be minimal")

    stub_count = sum(1 for p in pages.values() if p["body_length"] < 200)
    if stub_count > len(pages) * 0.3:
        warnings.append(f"{stub_count}/{len(pages)} pages are stubs (< 200 chars)")

    if not GRAPH_PATH.exists():
        warnings.append("graph.json not found — run build_graph first for optimal results")

    return {"critical": critical, "warnings": warnings}


def main():
    parser = argparse.ArgumentParser(description="Export wiki to agent assets")
    parser.add_argument("--target", choices=["mcp", "skill", "all"], default="all")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--incremental", action="store_true")
    parser.add_argument("--package", action="store_true", help="Package skill as .skill file")
    parser.add_argument("--config", type=Path, default=REPO_ROOT / "agent-kit-config.yaml")
    parser.add_argument("--skip-health-check", action="store_true", help="Skip pre-flight checks")
    args = parser.parse_args()

    # 加载配置
    config = load_config(args.config)

    # 解析 wiki
    from agent_kit.parser import parse_all_pages
    pages = parse_all_pages(WIKI_ROOT)

    # ── Step 0: Pre-flight health check ──
    health = run_preflight_check(pages)
    if health["critical"]:
        print("❌ Wiki has critical issues:")
        for issue in health["critical"]:
            print(f"   - {issue}")
        if not args.skip_health_check:
            sys.exit(1)
    if health["warnings"]:
        print("⚠️  Wiki warnings:")
        for w in health["warnings"]:
            print(f"   - {w}")

    # 加载图谱（安全降级）
    graph_data = load_graph(GRAPH_PATH)

    # 分析图谱
    from agent_kit.graph_analyzer import analyze_graph
    graph_analysis = analyze_graph(graph_data, pages)

    # 内容分级
    from agent_kit.triage import triage_pages
    triaged = triage_pages(pages, graph_analysis, config)

    # ── 增量更新：检测变更并复用已有索引 ──
    from agent_kit.indexer import load_cache, detect_changes, build_index
    cache = load_cache()
    added, modified, deleted = detect_changes(pages, WIKI_ROOT, cache)
    changed_slugs = added | modified | deleted if args.incremental else None

    if args.incremental and not changed_slugs:
        print("ℹ️  No changes detected. Skipping regeneration.")
        return

    # 生成 MCP Server
    if args.target in ("mcp", "all"):
        from agent_kit.mcp_generator import generate_mcp_server
        mcp_dir = args.output / "mcp-server"
        generate_mcp_server(triaged, graph_analysis, config, mcp_dir)
        print(f"✅ MCP Server generated: {mcp_dir}")

    # 生成 Skill
    if args.target in ("skill", "all"):
        from agent_kit.skill_generator import generate_skill
        skill_dir = args.output / "skills"
        skill_path = generate_skill(triaged, graph_analysis, config, skill_dir)
        print(f"✅ Skill generated: {skill_path}")

        # 打包
        if args.package:
            package_skill(skill_path)

    # 保存增量缓存
    new_cache = {slug: hashlib.sha256((WIKI_ROOT / p["path"]).read_bytes()).hexdigest()[:16]
                 for slug, p in pages.items() if (WIKI_ROOT / p["path"]).exists()}
    save_cache(new_cache)

if __name__ == "__main__":
    main()
```

### Phase 5: 验证与迭代（Day 9-10）

#### 5.5.1 验证清单

- [ ] `python tools/export_agent_kit.py --target mcp` 成功运行
- [ ] `python agent-kit/mcp-server/wiki_mcp_server.py` 启动无报错
- [ ] MCP Server 在 Claude Desktop / Cursor 中可连接
- [ ] `search_wiki` Tool 返回合理结果
- [ ] `get_page` Tool 能读取页面内容
- [ ] `find_connections` Tool 基于图谱返回关联
- [ ] Skill 的 SKILL.md 格式正确（YAML frontmatter + Markdown body）
- [ ] Skill 可在 Kimi CLI 中加载 (`/skill load`)
- [ ] Skill 加载后，Kimi 能引用其中的实体和概念信息
- [ ] 增量更新机制正确（修改 wiki 后重新生成，只变更受影响部分）

#### 5.5.2 性能基准

| 指标 | 目标值 | 测试方法 |
|------|--------|---------|
| 生成时间 (< 100 页) | < 5 秒 | `time python tools/export_agent_kit.py` |
| MCP Server 启动时间 | < 3 秒 | `time python wiki_mcp_server.py` |
| `search_wiki` 响应 | < 100ms | 多次调用取平均 |
| Skill 文件大小 | < 500KB | `du -h *.skill` |

---

## 六、两种形态对比与选择

### 6.1 能力矩阵

| 维度 | MCP Server | Kimi Skill |
|------|-----------|-----------|
| **知识时效性** | ⭐⭐⭐ 实时读取 wiki 文件 | ⭐⭐ 生成时快照，需定期重建 |
| **上下文大小** | ⭐⭐⭐ 按需检索，无上限 | ⭐⭐ 受限于 Kimi 上下文窗口 |
| **交互模式** | ⭐⭐⭐ Agent 主动调用 Tool | ⭐⭐ Kimi 被动加载知识 |
| **部署复杂度** | ⭐⭐ 需运行 Python 进程 | ⭐⭐⭐ 单个 `.skill` 文件 |
| **离线可用性** | ⭐⭐ 需本地运行 Server | ⭐⭐⭐ 纯文本，完全离线 |
| **多 Agent 共享** | ⭐⭐⭐ 任何 MCP 客户端可用 | ⭐⭐ 仅限 Kimi CLI |
| **动态查询** | ⭐⭐⭐ 支持复杂查询和图谱遍历 | ⭐⭐ 静态知识，无法遍历 |
| **知识深度** | ⭐⭐⭐ 可获取完整页面内容 | ⭐⭐ 受限于 Skill 大小 |

### 6.2 使用建议

| 场景 | 推荐形态 | 原因 |
|------|---------|------|
| **日常查询** | MCP Server | 实时、完整、支持动态搜索 |
| **离线环境** | Kimi Skill | 无需运行额外进程 |
| **快速回答** | 两者结合 | Skill 提供框架，MCP 补充细节 |
| **团队共享** | MCP Server | 一次部署，多客户端共用 |
| **分发传播** | Kimi Skill | `.skill` 文件易于分享 |
| **写作辅助** | Kimi Skill | 上下文常驻，响应更快 |

### 6.3 推荐组合模式

```
用户提问
    │
    ▼
┌─────────────────┐
│ Kimi (带 Skill) │  ← Skill 提供领域框架和关键实体
│                 │     "我知道 OpenAI、Transformer 这些..."
└────────┬────────┘
         │
         ▼
    是否需要具体细节？
         │
    ┌────┴────┐
    ▼         ▼
   否        是
    │         │
    ▼         ▼
 直接回答   调用 MCP Tool
            (search_wiki / get_page)
                │
                ▼
            获取最新 wiki 内容
                │
                ▼
            综合回答
```

---

## 七、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| **wiki 内容不足** | Skill 空洞、MCP 查无结果 | 设置最低页面数阈值（如 < 5 页不生成）；生成时标注"知识库建设中" |
| **生成时间过长** | 阻碍增量更新 | 使用增量模式（只处理变更文件）；缓存解析结果 |
| **MCP Server 崩溃** | Agent 无法查询 | 添加健康检查 endpoint；优雅降级（返回"知识库暂不可用"） |
| **Skill 过大** | 超出上下文预算 | 实施严格的内容分级（P0/P1/P2）；提供 "compact" 模式只含 P0 |
| **图谱数据缺失** | `find_connections` 不可用 | 降级为基于 wikilinks 的简易关联；提示用户先运行 `build_graph` |
| **路径遍历攻击** | 安全风险 | `read_wiki_page()` 中 resolve + prefix 检查；拒绝包含 `..` 的路径 |
| **Windows 路径问题** | 资源 URI 解析失败 | 所有路径操作使用 `.as_posix()`；URI 中统一使用正斜杠 |

---

## 八、附录

### A. 完整配置示例

```yaml
# agent-kit-config.yaml

# ── MCP Server 配置 ──
mcp:
  name: "llm-wiki"
  transport: stdio           # stdio | http
  description: "Knowledge base MCP server for LLM Wiki"

  tools:
    enabled:
      - search_wiki
      - get_page
      - get_overview
      - find_connections
      - list_sources
      - ask_wiki

  prompts:
    enabled:
      - summarize_topic
      - compare_entities
      - trace_evolution

  resources:
    include_all_pages: true    # 为每个 wiki 页面生成 Resource
    max_size: 100000           # 单 resource 最大字符数

# ── Skill 配置 ──
skill:
  name: "llm-wiki-knowledge"
  title: "LLM Wiki Knowledge"
  description: |
    提供关于大型语言模型、Transformer 架构和相关 AI 领域知识的深度支持。
    使用场景：回答专业问题、解释技术概念、对比实体、梳理发展脉络。

  max_entities: 10
  max_concepts: 10
  page_min_length: 300       # 过滤 stub 页面
  include_references: true   # 打包 references/
  include_timeline: true     # 从 sources 日期生成时间线
  include_contradictions: true
  include_gaps: true

  # 内容压缩策略
  compression:
    entity_summary_max_chars: 300   # 2-3 句话：背景 + 关键贡献
    concept_summary_max_chars: 500  # 定义 + 原理 + 典型应用
    reference_max_chars: 3000       # 容纳更多上下文细节

  # 多 Skill 拆分（可选）
  splits:
    - name: "llm-foundations"
      filter:
        types: [concept, entity]
        tags_include: [architecture, nlp]
      max_items: 20

# ── 生成控制 ──
generation:
  incremental: true          # 只处理变更文件
  cache_dir: ".cache/agent-kit"
  optimize_descriptions: false  # 是否调用 LLM 优化描述
```

### B. MCP Server 快速测试脚本

```python
# test_mcp_server.py
"""Quick test for the generated MCP server."""
import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def test():
    params = StdioServerParameters(
        command="python",
        args=["agent-kit/mcp-server/wiki_mcp_server.py"],
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # List tools
            tools = await session.list_tools()
            print("Tools:", [t.name for t in tools.tools])

            # Call search
            result = await session.call_tool("search_wiki", {"query": "transformer"})
            print("Search result:", result)

asyncio.run(test())
```

### C. Skill 打包与验证脚本

```python
# package_skill.py
"""Package and validate a Kimi Skill."""
import zipfile
from pathlib import Path
import yaml

def validate_skill(skill_dir: Path) -> list[str]:
    """Validate skill structure. Returns list of errors."""
    errors = []

    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        errors.append("Missing SKILL.md")
        return errors

    text = skill_md.read_text(encoding="utf-8")
    if not text.startswith("---"):
        errors.append("SKILL.md missing YAML frontmatter")
        return errors

    # Parse frontmatter
    try:
        fm_end = text.index("---", 3)
        frontmatter = yaml.safe_load(text[3:fm_end])
    except Exception as e:
        errors.append(f"Invalid frontmatter: {e}")
        return errors

    if "name" not in frontmatter:
        errors.append("Missing 'name' in frontmatter")
    if "description" not in frontmatter:
        errors.append("Missing 'description' in frontmatter")
    if len(frontmatter.get("description", "")) < 20:
        errors.append("Description too short (< 20 chars)")

    return errors

def package_skill(skill_dir: Path, output: Path):
    """Package skill directory into .skill file."""
    errors = validate_skill(skill_dir)
    if errors:
        print(f"Validation failed for {skill_dir}:")
        for e in errors:
            print(f"  - {e}")
        return False

    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zf:
        for file in skill_dir.rglob("*"):
            if file.is_file():
                zf.write(file, file.relative_to(skill_dir))

    print(f"✅ Packaged: {output} ({output.stat().st_size} bytes)")
    return True
```

### D. 与现有工具的关系

| 现有工具 | 本方案使用方式 |
|---------|--------------|
| `tools/ingest.py` | 添加 `post_ingest_hooks()` 自动触发 agent-kit 重建 |
| `tools/build_graph.py` | 生成的 `graph.json` 是 `find_connections` 和 Skill 实体精选的数据源 |
| `tools/query.py` | Skill 的 `ask_wiki` Prompt 可引导 Agent 使用类似逻辑 |
| `tools/health.py` | 在生成前运行，确保 wiki 结构完整，避免生成空 Skill |
| `tools/lint.py` | 在生成前运行，确保关键实体有页面，提升 Skill 质量 |

---

## 九、新增功能对比

### 9.1 现有系统 vs 本方案新增功能

| 功能维度 | 现有 Wiki 系统 | 本方案新增 | 价值变化 |
|---------|---------------|-----------|---------|
| **知识消费方式** | 人工浏览 markdown 文件 | Agent 通过 MCP Tool 实时查询 | 从"人读"到"机器读" |
| **知识检索** | 依赖文件系统搜索或记忆 | `search_wiki` / `find_connections` | 结构化语义检索 |
| **跨工具复用** | 仅限本项目的 wiki-viewer | 任何 MCP 客户端（Claude/Cursor/VS Code） | 生态级复用 |
| **上下文注入** | 无 | Kimi Skill 加载后常驻上下文 | Agent 具备领域直觉 |
| **知识同步** | 手动更新 | ingest 后自动触发 agent-kit 重建 | 零维护成本 |
| **关系遍历** | 人工点击 wikilinks | `find_connections` BFS 自动遍历 | 深度关联发现 |
| **问答能力** | `tools/query.py` 需要 LLM API | `ask_wiki` Tool 提供 RAG 上下文 | 降低 API 成本 |
| **离线可用** | 需启动 api_server.py | Skill 纯文本，完全离线 | 无依赖使用 |
| **团队分发** | Git 仓库共享 | `.skill` 文件一键分享 | 非技术人员可用 |
| **多领域拆分** | 单一知识库 | 自动按类型/标签拆分为多个 Skill | 精准上下文加载 |

### 9.2 手动维护 vs 自动生成对比

| 维护方式 | 工作量 | 一致性 | 时效性 | 错误率 | 适用场景 |
|---------|--------|--------|--------|--------|---------|
| **手动写 MCP Server** | 高（每新增页面需手动注册 Resource/Tool） | 依赖人工 | 滞后 | 高（遗漏、路径错误） | 一次性项目 |
| **自动生成（本方案）** | 零（ingest 后自动重建） | 100% 与 wiki 同步 | 实时 | 低（模板驱动） | 持续演进的知识库 |
| **半自动（LLM 优化）** | 中（生成后人工审阅描述） | 高 | 近实时 | 中 | 对描述质量要求极高 |

### 9.3 MCP Server vs Kimi Skill 功能细节对比

| 功能场景 | MCP Server | Kimi Skill | 推荐组合 |
|---------|-----------|-----------|---------|
| **"Transformer 是什么？"** | `get_page("concepts/Transformer.md")` | Skill 中直接引用概念定义 | Skill 回答框架 + MCP 补充细节 |
| **"OpenAI 和 Google 有什么关系？"** | `find_connections("OpenAI", depth=2)` | Skill 中预置关系网描述 | Skill 直接回答（关系已预计算） |
| **" wiki 里有关于 RLHF 的内容吗？"** | `search_wiki("RLHF")` → 返回空列表 | Skill 的"知识缺口"章节已标注 | Skill 直接告知"尚未覆盖" |
| **"对比 GPT 和 BERT"** | `compare_entities` Prompt + `get_page` | Skill 中预置对比表格 | Skill 直接回答 |
| **"2023 年 LLM 领域发生了什么？"** | `list_sources` + 日期过滤 | Skill 中预置时间线 | Skill 直接回答 |
| **"Attention Is All You Need 的核心主张是什么？"** | `get_page("sources/attention-is-all-you-need.md")` | `references/attention-is-all-you-need.md` | 两者皆可，Skill 更快 |
| **"wiki 中有哪些矛盾观点？"** | `find_contradictions` Prompt | Skill 中预置矛盾列表 | Skill 直接回答 |
| **"我不确定的某个细节"** | `ask_wiki("...")` → RAG 检索 | 无法回答（超出 Skill 范围） | 必须用 MCP |

### 9.4 与外部方案对比

| 对比维度 | 本方案 | 直接使用 `tools/query.py` | 使用向量数据库 RAG | 使用 Notion/Confluence API |
|---------|--------|--------------------------|-------------------|---------------------------|
| **数据主权** | 本地文件，完全可控 | 本地文件 | 需额外服务 | 依赖第三方平台 |
| **结构感知** | 强（YAML frontmatter + wikilinks + graph） | 中（仅 markdown 文本） | 弱（仅文本块） | 中（页面结构） |
| **关系遍历** | 原生支持（图谱 BFS） | 不支持 | 不支持 | 弱（仅页面链接） |
| **增量成本** | 零（自动） | 每次 query 调用 LLM | 需重建索引 | 需同步 API |
| **Agent 集成** | MCP 原生协议 | 需自定义封装 | 需自定义封装 | 需自定义封装 |
| **离线能力** | Skill 完全离线 | 需 LLM API | 需向量服务 | 需网络 |
| **适用规模** | < 10,000 页 | 任意 | 大规模 | 中等 |

---

## 十、架构优化建议（已整合至 v1.2）

> **评审日期**: 2026-04-29  
> **评审结论**: 架构合理（8.5/10），方向正确。以下 8 项优化已全部反向整合到第 2–5 章及附录的设计方案中。本章保留作为评审记录与溯源依据。

### 10.1 优化项总览

| # | 优化项 | 类型 | 优先级 | 影响范围 |
|---|--------|------|--------|----------|
| 1 | 增量更新机制完善 | 性能 | P0 | `indexer.py` |
| 2 | 搜索性能优化（消除 O(n) 回退扫描） | 性能 | P0 | `wiki_index.py` |
| 3 | 中文分词支持 | 正确性 | P0 | `indexer.py` |
| 4 | Skill 压缩比调整 | 质量 | P1 | `agent-kit-config.yaml` |
| 5 | 添加 pre-flight 健康校验 | 可靠性 | P1 | `export_agent_kit.py` |
| 6 | graph.json 加载异常处理 | 健壮性 | P1 | `export_agent_kit.py` |
| 7 | graph_client 内存优化 | 可扩展性 | P2 | `graph_client.py` |
| 8 | 性能基准目标值修正 | 度量 | P2 | 文档 |

---

### 10.2 优化项详细说明

#### 优化 1：增量更新机制完善

**问题：** 文档 4.4 节提到了 `--incremental` 参数，但未描述如何检测变更和增量更新索引。`build_index()` 每次都全量重建倒排索引。

**当前代码（indexer.py）：**
```python
# 每次全量遍历
for slug, page in pages.items():
    text = f"{page['title']} {page['body']}".lower()
    words = set(re.findall(r'\b[a-z]{3,}\b', text))
    for word in words:
        inverted[word].append(slug)
```

**优化方案：**

```python
# tools/agent_kit/indexer.py（增量版）
import json
import hashlib
from pathlib import Path

CACHE_FILE = Path(__file__).parent.parent.parent / "graph" / ".agent_kit_cache.json"

def load_cache() -> dict[str, str]:
    """加载文件 hash 缓存 {slug: sha256}"""
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    return {}

def save_cache(cache: dict[str, str]):
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")

def compute_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]

def detect_changes(pages: dict, cache: dict) -> tuple[set, set, set]:
    """返回 (新增, 修改, 删除) 的 slug 集合。"""
    current = {slug: compute_hash(Path(page["path"])) for slug, page in pages.items()}
    added = set(current.keys()) - set(cache.keys())
    modified = {s for s in current if s in cache and current[s] != cache[s]}
    deleted = set(cache.keys()) - set(current.keys())
    return added, modified, deleted

def build_incremental_index(
    pages: dict[str, dict],
    existing_index: dict | None = None,
    changed_slugs: set[str] | None = None
) -> dict:
    """增量更新索引，只处理变更的页面。"""
    if existing_index is None:
        existing_index = {"page_index": {}, "inverted": defaultdict(list),
                          "tag_index": defaultdict(list), "type_index": defaultdict(list)}
    
    index = existing_index.copy()
    slugs_to_process = changed_slugs if changed_slugs else set(pages.keys())
    
    for slug in slugs_to_process:
        # 先移除旧条目（如果存在）
        _remove_from_index(index, slug)
        
        if slug not in pages:
            continue  # 已删除
        
        page = pages[slug]
        # 添加新条目（逻辑同全量构建）
        _add_to_index(index, slug, page)
    
    return index
```

**性能收益：** 100 页 wiki 增量更新从全量 ~2 秒降至 ~0.2 秒。

---

#### 优化 2：搜索性能优化（消除 O(n) 回退扫描）

**问题：** `search_index()` 有两层查找——倒排索引匹配（O(1)）+ 标题/summary 回退扫描（O(n)）。当 wiki 页数增长时，回退扫描成为瓶颈。

**问题代码（wiki_index.py 模板）：**
```python
# 回退扫描：每次查询都遍历全部页面
for slug, info in PAGE_INDEX.items():
    text = f"{info['title']} {info['summary']}".lower()
    for word in words:
        if word in text:
            scores[slug] = scores.get(slug, 0) + 0.5
```

**优化方案：将标题和 summary 也纳入倒排索引**

```python
def build_index(pages: dict[str, dict]) -> dict:
    """构建索引时，将标题和 summary 的分词也加入倒排索引。"""
    inverted = defaultdict(list)
    page_index = {}
    
    for slug, page in pages.items():
        page_index[slug] = {
            "title": page["title"],
            "path": page["path"],
            "type": page["type"],
            "tags": page["tags"],
            "summary": page["body"][:200].replace('\n', ' ') + "...",
        }
        
        # 对 body、title、summary 统一分词并加入倒排索引
        text = f"{page['title']} {page['body'][:500]}"
        words = tokenize(text)  # 使用优化 3 的 tokenize
        
        for word in words:
            inverted[word].append(slug)
    
    return {"page_index": page_index, "inverted": dict(inverted), ...}

def search_index(query: str, limit: int = 5) -> list[dict]:
    """纯倒排索引搜索，消除 O(n) 回退。"""
    query_words = tokenize(query)
    scores = defaultdict(float)
    
    for word in query_words:
        for slug in INVERTED_INDEX.get(word, []):
            scores[slug] += 1.0  # 统一计分，不再区分权重
    
    sorted_slugs = sorted(scores.keys(), key=lambda s: scores[s], reverse=True)[:limit]
    return [{"title": PAGE_INDEX[s]["title"], "path": PAGE_INDEX[s]["path"],
             "type": PAGE_INDEX[s]["type"], "excerpt": PAGE_INDEX[s]["summary"],
             "score": scores[s]} for s in sorted_slugs]
```

**性能收益：** 搜索从 O(n) 降至 O(k)，k = 匹配词条数，通常在 1-20 之间。

---

#### 优化 3：中文分词支持

**问题：** 当前分词正则 `\b[a-z]{3,}\b` 只匹配英文字母，完全不支持中文。wiki 已有中英双语内容。

**问题代码：**
```python
words = set(re.findall(r'\b[a-z]{3,}\b', text))
```

**优化方案：添加轻量中文 bigram 分词，无需额外依赖**

```python
import re

def tokenize(text: str) -> set[str]:
    """分词：支持英文 + 中文 bigram（无需 jieba 等额外依赖）。"""
    tokens = set()
    
    # 英文词（≥3 个字母）
    tokens.update(re.findall(r'\b[a-z]{3,}\b', text.lower()))
    
    # 中文 bigram（轻量方案，避免引入 jieba 依赖）
    chinese_segments = re.findall(r'[\u4e00-\u9fff]+', text)
    for segment in chinese_segments:
        for i in range(len(segment) - 1):
            tokens.add(segment[i:i+2])
    
    # 英文 bigram（作为长词的补充，提高召回率）
    english_words = re.findall(r'\b[a-z]+\b', text.lower())
    for word in english_words:
        if len(word) >= 6:  # 仅对长词做 bigram
            for i in range(len(word) - 1):
                tokens.add(f"en:{word[i:i+2]}")
    
    return tokens
```

**说明：** 使用 bigram 而非引入 jieba 分词库，原因是：
- 无外部依赖，与 MCP Server 的轻量化目标一致
- bigram 对 wiki 检索场景足够（查全率优先）
- 如果需要更高精度，可在 `agent-kit-config.yaml` 中配置 `use_jieba: true` 并可选引入

---

#### 优化 4：Skill 压缩比调整

**问题：** 当前压缩比过于激进，150 字符约为一句话，Agent 无法根据如此简略的描述做出准确判断。

**当前配置：**
```yaml
compression:
  entity_summary_max_chars: 150   # ❌ 太短
  concept_summary_max_chars: 300  # ❌ 偏短
  reference_max_chars: 2000       # ✅ 合理
```

**优化后配置：**
```yaml
compression:
  entity_summary_max_chars: 300   # 2-3 句话，包含关键背景
  concept_summary_max_chars: 500  # 定义 + 一个关键要点 + 一个典型应用
  reference_max_chars: 3000       # 可适度增加，容纳更多上下文
```

**调整依据：**

| 压缩层级 | 旧值 | 新值 | 理由 |
|----------|------|------|------|
| entity_summary | 150 chars | 300 chars | 人物/公司需背景 + 关键贡献，150 字符写不下 |
| concept_summary | 300 chars | 500 chars | 技术概念需定义 + 原理 + 应用场景 |
| reference_max | 2000 chars | 3000 chars | 对 2000 字符以上的页面丢失过多细节 |

---

#### 优化 5：添加 pre-flight 健康校验

**问题：** 管线在生成前不做健康检查。如果 wiki 存在大量 broken wikilinks、empty stubs、或 index 不同步，生成的 Skill 质量会很差。

**优化方案：在 `export_agent_kit.py` 的 `main()` 中添加前置检查**

```python
# tools/export_agent_kit.py（修改 main 函数）
def main():
    args = parser.parse_args()

    # ── Step 0: Pre-flight health check ──
    health_issues = run_preflight_check(WIKI_ROOT)
    if health_issues["critical"]:
        print("❌ Wiki has critical issues. Run /wiki-health first.")
        for issue in health_issues["critical"]:
            print(f"   - {issue}")
        print("   Use --skip-health-check to bypass (not recommended).")
        if not args.skip_health_check:
            sys.exit(1)
    if health_issues["warnings"]:
        print("⚠️  Wiki has warnings:")
        for w in health_issues["warnings"]:
            print(f"   - {w}")
        print("   Continuing anyway...")

    # ... 继续原有流程 ...


def run_preflight_check(wiki_root: Path) -> dict:
    """轻量前置检查（不依赖 LLM，仅做结构性校验）。"""
    critical = []
    warnings = []
    
    # 检查 wiki 目录存在且非空
    md_files = list(wiki_root.rglob("*.md"))
    if len(md_files) == 0:
        critical.append("wiki/ contains no markdown files")
    elif len(md_files) < 5:
        warnings.append(f"wiki/ has only {len(md_files)} pages — Skill will be minimal")
    
    # 检查 graph.json
    graph_path = REPO_ROOT / "graph" / "graph.json"
    if not graph_path.exists():
        warnings.append("graph.json not found — run build_graph first for optimal results")
    
    # 检查空 stub 页面（< 200 字符 body）
    stub_count = 0
    for md_file in md_files:
        text = md_file.read_text(encoding="utf-8")
        # 去掉 frontmatter
        if text.startswith("---"):
            parts = text.split("---", 2)
            body = parts[2].strip() if len(parts) >= 3 else ""
        else:
            body = text.strip()
        if len(body) < 200:
            stub_count += 1
    if stub_count > len(md_files) * 0.3:
        warnings.append(f"{stub_count}/{len(md_files)} pages are stubs (< 200 chars)")
    
    return {"critical": critical, "warnings": warnings}
```

---

#### 优化 6：graph.json 加载异常处理

**问题：** `export_agent_kit.py` 的 `main()` 直接调用 `load_graph()` 而无 try/except，格式损坏的 graph.json 会导致整个生成流程崩溃。

**优化方案：**

```python
def load_graph(graph_path: Path) -> dict:
    """安全加载知识图谱，损坏时降级而非崩溃。"""
    if not graph_path.exists():
        print("⚠️  graph.json not found — graph-based features disabled")
        return {"nodes": [], "edges": []}
    
    try:
        data = json.loads(graph_path.read_text(encoding="utf-8"))
        # 基本结构校验
        if "nodes" not in data or "edges" not in data:
            raise ValueError("Missing required keys: 'nodes' or 'edges'")
        return data
    except (json.JSONDecodeError, ValueError) as e:
        print(f"⚠️  graph.json is corrupted ({e}) — graph-based features disabled")
        print("   Run 'python tools/build_graph.py' to regenerate.")
        return {"nodes": [], "edges": []}
```

---

#### 优化 7：graph_client 内存优化（P2，远期）

**问题：** `GraphClient._load()` 一次性将整个 graph.json 加载并构建邻接表。当前 wiki 规模下（< 500 节点）完全够用，但预留扩展路径。

**当前状态：** 对 < 10MB 的 graph.json，一次性加载是合理的。

**远期优化方案（当节点数 > 5000 时考虑）：**

```python
# 方案 A: 懒加载 — 首次查询时才加载
class GraphClient:
    def __init__(self, lazy: bool = False):
        self._graph = None
        self._adj = None
        self._lazy = lazy
        if not lazy:
            self._load()  # 默认行为不变

# 方案 B: SQLite 存储（节点 > 10,000 时）
# import sqlite3
# conn = sqlite3.connect(str(GRAPH_PATH.with_suffix('.db')))
# conn.execute("CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source)")
```

> **当前不实施。** 直到 wiki 规模触及 5000+ 节点前，JSON 全量加载的简单性价值高于内存优化。

---

#### 优化 8：性能基准目标值修正

**问题：** 原文档 5.5.2 节的几个目标值需要调整。

| 指标 | 原目标 | 修正后 | 修正原因 |
|------|--------|--------|----------|
| 生成时间 (< 100 页) | < 5 秒 | **不变** | 纯 Python I/O + JSON，可达 |
| MCP 启动时间 | < 2 秒 | < 3 秒 | 包含 graph.json 解析 + 邻接表构建，放宽 1 秒更现实 |
| `search_wiki` 响应 | < 100ms | **不变** | 内存 dict 查找，远低于此 |
| Skill 文件大小 | < 100KB | < 500KB | 如果 `include_references=true`，原目标不可达；放宽到 500KB 兼顾质量 |

---

### 10.3 实施优先级

```
P0（必须在 Phase 1 完成）:
├── 优化 1: 增量更新机制 ── 决定日常使用的流畅度
├── 优化 2: 搜索 O(n) 消除 ── 决定查询响应速度
└── 优化 3: 中文分词支持 ── 决定多语言 wiki 的搜索正确性

P1（Phase 2-3 完成）:
├── 优化 4: Skill 压缩比调整 ── 影响输出质量
├── 优化 5: pre-flight 健康校验 ── 防止劣质输入
└── 优化 6: graph.json 异常处理 ── 提升鲁棒性

P2（Phase 4+ 远期）:
├── 优化 7: graph_client 内存优化 ── 仅在规模增长时实施
└── 优化 8: 性能基准修正 ── 文档更新
```

---

## 结语

本方案将 LLM Wiki Agent 的静态知识库转化为动态的 Agent 资产，实现了**"知识一次构建，多处复用"**的目标：

- **MCP Server** 让任何支持 MCP 的 Agent 都能实时查询、搜索、遍历你的知识库
- **Kimi Skill** 让 Kimi CLI 具备领域专家级别的上下文理解能力

两者互补，形成完整的 Agent 知识增强体系。
