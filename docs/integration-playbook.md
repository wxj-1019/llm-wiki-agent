# LLM Wiki Agent — 整合实施手册

> 版本：v1.0 | 日期：2026-05-04
> 范围：Top 5 高价值整合方向，含架构设计、代码示例与决策树

---

## 一、手册使用指南

### 1.1 如何选择整合方向

```
你的首要痛点是什么？
    │
    ├── Agent 无法读写 Wiki ──→ 整合 1: MCP Server
    │
    ├── 搜索不准/找不到内容 ──→ 整合 2: 混合搜索升级
    │
    ├── 手动操作太繁琐 ───────→ 整合 3: 自动化工作流
    │
    ├── 知识可视化太单调 ─────→ 整合 4: 可视化增强套件
    │
    └── Agent 每次从零开始 ───→ 整合 5: Agent Memory 层
```

### 1.2 评估维度

每个整合按以下维度评分：

| 维度 | 含义 | 评分 |
|------|------|------|
| **战略价值** | 对竞争力的提升程度 | ⭐–⭐⭐⭐⭐⭐ |
| **实现难度** | 技术复杂度和工作量 | 🔧–🔧🔧🔧🔧🔧 |
| **维护成本** | 长期运营开销 | 💰–💰💰💰💰💰 |
| **用户可见** | 终端用户是否直接感知 | 👁–👁👁👁👁👁 |

---

## 二、整合 1：MCP Server — Agent 生态入口

> **战略价值**：⭐⭐⭐⭐⭐ | **实现难度**：🔧🔧🔧 | **维护成本**：💰💰 | **用户可见**：👁👁

### 2.1 Why

2026 年 4–5 月的竞品 wave 证明：**没有 MCP Server 的 Wiki 工具已失去 Agent 生态的接入能力**。当前 100% 新进入者都实现了 MCP，本项目是唯一直接竞品中缺失的。

MCP Server 让任何支持 MCP 的 Agent（Claude Code、Cursor、Codex、Cline、Gemini CLI）能够：
- 搜索和读取 Wiki 内容
- 写入和更新 Wiki 页面
- 触发 ingest、lint、health 等工作流

### 2.2 Architecture

```
┌─────────────────┐     stdio/SSE      ┌─────────────────┐
│  Claude Code    │◄──────────────────►│  MCP Server     │
│  / Cursor       │                    │  (FastMCP)      │
│  / Codex        │                    └────────┬────────┘
└─────────────────┘                             │
                                                ▼
                                       ┌─────────────────┐
                                       │  wiki/          │
                                       │  raw/           │
                                       │  graph/         │
                                       └─────────────────┘
```

### 2.3 Implementation

**Step 1: 安装依赖**

```bash
pip install mcp
```

**Step 2: 核心实现**

```python
# tools/mcp_server.py
#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from typing import AsyncIterator

# Ensure shared imports work when run directly
REPO_ROOT = Path(__file__).parent.parent
_repo_root_str = str(REPO_ROOT)
if _repo_root_str not in sys.path:
    sys.path.insert(0, _repo_root_str)

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("ERROR: mcp package not installed. Run: pip install mcp", file=sys.stderr)
    sys.exit(1)

try:
    from tools.shared.wiki import all_wiki_pages, read_file, extract_wikilinks
except ImportError:
    # Inline minimal fallback
    def all_wiki_pages() -> list[dict]: ...
    def read_file(path: Path) -> str: ...

mcp = FastMCP("llm-wiki-agent")


@mcp.tool()
def wiki_search(query: str, type_filter: str = "") -> list[dict]:
    """Search wiki pages by title and content.
    
    Args:
        query: Search query string
        type_filter: Optional filter by page type (source/entity/concept/synthesis)
    
    Returns:
        List of matching pages with title, path, type, and excerpt
    """
    pages = all_wiki_pages()
    results = []
    q = query.lower()
    
    for page in pages:
        if type_filter and page.get("type") != type_filter:
            continue
        content = read_file(page["path"]).lower()
        title = page.get("title", "").lower()
        if q in title or q in content:
            excerpt = content[max(0, content.find(q)-100):content.find(q)+200]
            results.append({
                "title": page.get("title"),
                "path": str(page["path"]),
                "type": page.get("type"),
                "excerpt": excerpt.strip(),
            })
    
    return results[:20]


@mcp.tool()
def wiki_read(path: str, section: str = "") -> dict:
    """Read a wiki page by path.
    
    Args:
        path: Wiki page path (e.g., 'wiki/sources/my-paper.md')
        section: Optional section heading to extract
    
    Returns:
        Page content with frontmatter metadata
    """
    file_path = REPO_ROOT / path
    # Security: prevent path traversal
    if not str(file_path.resolve()).startswith(str(REPO_ROOT.resolve())):
        return {"error": "Invalid path: path traversal detected"}
    
    if not file_path.exists():
        return {"error": f"Page not found: {path}"}
    
    content = read_file(file_path)
    
    if section:
        # Extract specific section
        lines = content.split("\n")
        in_section = False
        section_lines = []
        for line in lines:
            if line.startswith(f"## {section}") or line.startswith(f"### {section}"):
                in_section = True
                continue
            if in_section and line.startswith("##"):
                break
            if in_section:
                section_lines.append(line)
        content = "\n".join(section_lines)
    
    return {
        "path": path,
        "content": content,
        "size": len(content),
    }


@mcp.tool()
def wiki_list(page_type: str = "") -> list[dict]:
    """List all wiki pages, optionally filtered by type.
    
    Args:
        page_type: Filter by type (source/entity/concept/synthesis/overview)
    
    Returns:
        List of pages with title, path, and type
    """
    pages = all_wiki_pages()
    if page_type:
        pages = [p for p in pages if p.get("type") == page_type]
    return [
        {"title": p.get("title"), "path": str(p["path"]), "type": p.get("type")}
        for p in pages
    ]


@mcp.tool()
def wiki_write(path: str, content: str, append: bool = False) -> dict:
    """Create or update a wiki page.
    
    Args:
        path: Target wiki page path
        content: Full page content (must include YAML frontmatter)
        append: If True, append to existing content instead of overwriting
    
    Returns:
        Success status and written path
    """
    file_path = REPO_ROOT / "wiki" / path
    if not str(file_path.resolve()).startswith(str((REPO_ROOT / "wiki").resolve())):
        return {"error": "Invalid path: must be within wiki/ directory"}
    
    file_path.parent.mkdir(parents=True, exist_ok=True)
    
    if append and file_path.exists():
        existing = read_file(file_path)
        content = existing + "\n\n" + content
    
    file_path.write_text(content, encoding="utf-8")
    
    # Auto-update index if new page
    # (trigger health.py or index update logic)
    
    return {"success": True, "path": str(file_path), "bytes_written": len(content)}


@mcp.tool()
def wiki_ingest(file_path: str) -> dict:
    """Ingest a raw file into the wiki.
    
    Args:
        file_path: Path to raw file (relative to repo root or absolute)
    
    Returns:
        Ingestion result with created pages
    """
    import subprocess
    result = subprocess.run(
        [sys.executable, str(REPO_ROOT / "tools" / "ingest.py"), file_path],
        capture_output=True,
        text=True,
    )
    return {
        "success": result.returncode == 0,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


@mcp.tool()
def wiki_health() -> dict:
    """Run health check on the wiki.
    
    Returns:
        Health report summary
    """
    import subprocess
    result = subprocess.run(
        [sys.executable, str(REPO_ROOT / "tools" / "health.py"), "--json"],
        capture_output=True,
        text=True,
    )
    import json
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"raw_output": result.stdout}


@mcp.tool()
def wiki_lint() -> dict:
    """Run lint check on the wiki.
    
    Returns:
        Lint report summary
    """
    import subprocess
    result = subprocess.run(
        [sys.executable, str(REPO_ROOT / "tools" / "lint.py")],
        capture_output=True,
        text=True,
    )
    return {
        "success": result.returncode == 0,
        "output": result.stdout,
    }


if __name__ == "__main__":
    mcp.run()
```

**Step 3: Claude Code 配置**

```json
// ~/.claude/mcp.json
{
  "mcpServers": {
    "llm-wiki": {
      "command": "python",
      "args": ["tools/mcp_server.py"],
      "env": {
        "LLM_MODEL": "claude-3-5-sonnet-latest"
      }
    }
  }
}
```

**Step 4: 测试**

```bash
python tools/mcp_server.py
# 在另一个终端测试连接
claude mcp test llm-wiki
```

### 2.4 Risk & Mitigation

| 风险 | 缓解 |
|------|------|
| `wiki_write` 路径遍历攻击 | 代码中已加入 `str(file_path.resolve()).startswith()` 检查 |
| LLM 调用成本过高 | 参考 `llm-wiki` 的 `cloud_hourly_limit` 设计 |
| MCP 工具设计过复杂 | 从 6 工具 MVP 开始，根据实际使用反馈扩展 |

---

## 三、整合 2：混合搜索 — 从字符串到语义

> **战略价值**：⭐⭐⭐⭐⭐ | **实现难度**：🔧🔧 | **维护成本**：💰 | **用户可见**：👁👁👁👁👁

### 3.1 Why

当前 Fuse.js 字符串匹配无法理解"LLM"和"大语言模型"的等价性。MeMex 已实现 BM25 + 语义混合，casper 使用 Neo4j 向量索引。**搜索体验是用户每天使用的核心功能**，必须升级。

### 3.2 Architecture

```
用户输入查询
    │
    ▼
┌─────────────┐    ┌─────────────┐
│  FTS5 召回   │───►│  Top 50     │
│  (关键词)    │    │  候选       │
└─────────────┘    └──────┬──────┘
                          │
    ┌─────────────────────┘
    ▼
┌─────────────┐    ┌─────────────┐
│  Fuse.js    │───►│  Top 20     │
│  (模糊精排)  │    │  结果       │
└─────────────┘    └─────────────┘

Phase 2 可选增强：
┌─────────────┐
│  语义嵌入    │───► 与 FTS5 结果做 RRF 融合
│  (Ollama)   │
└─────────────┘
```

### 3.3 Implementation

**Step 1: SQLite FTS5 引擎**

```python
# tools/search_engine.py
import sqlite3
import re
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
DB_PATH = REPO_ROOT / "state" / "search.db"


class WikiSearchEngine:
    def __init__(self):
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(DB_PATH))
        self.conn.row_factory = sqlite3.Row
        self._init_fts()
    
    def _init_fts(self):
        self.conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS wiki_pages
            USING fts5(title, content, type, tags, path,
                       tokenize='porter unicode61')
        """)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS page_meta (
                path TEXT PRIMARY KEY,
                title TEXT,
                type TEXT,
                tags TEXT,
                last_indexed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        self.conn.commit()
    
    @staticmethod
    def _strip_frontmatter(content: str) -> str:
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                return parts[2].strip()
        return content
    
    def index_page(self, path: Path, title: str, content: str, 
                   page_type: str, tags: list[str]):
        clean_content = self._strip_frontmatter(content)
        tags_str = " ".join(tags)
        
        self.conn.execute("""
            INSERT OR REPLACE INTO wiki_pages(path, title, content, type, tags)
            VALUES(?,?,?,?,?)
        """, (str(path), title, clean_content, page_type, tags_str))
        
        self.conn.execute("""
            INSERT OR REPLACE INTO page_meta(path, title, type, tags)
            VALUES(?,?,?,?)
        """, (str(path), title, page_type, tags_str))
        
        self.conn.commit()
    
    def search(self, query: str, limit: int = 20) -> list[dict]:
        cursor = self.conn.execute("""
            SELECT path, title, type, rank
            FROM wiki_pages
            WHERE wiki_pages MATCH ?
            ORDER BY rank
            LIMIT ?
        """, (query, limit * 2))
        
        results = []
        for row in cursor.fetchall():
            results.append({
                "path": row["path"],
                "title": row["title"],
                "type": row["type"],
                "rank": row["rank"],
            })
        return results
    
    def rebuild_index(self):
        """Rebuild entire index from wiki/ directory."""
        import sys
        sys.path.insert(0, str(REPO_ROOT))
        from tools.shared.wiki import all_wiki_pages
        
        self.conn.execute("DELETE FROM wiki_pages")
        
        for page in all_wiki_pages():
            try:
                content = page["path"].read_text(encoding="utf-8")
                self.index_page(
                    path=page["path"],
                    title=page.get("title", ""),
                    content=content,
                    page_type=page.get("type", ""),
                    tags=page.get("tags", []),
                )
            except Exception:
                continue
        
        self.conn.commit()


# Singleton instance
_engine = None

def get_engine() -> WikiSearchEngine:
    global _engine
    if _engine is None:
        _engine = WikiSearchEngine()
    return _engine
```

**Step 2: API Server 集成**

```python
# api_server.py 新增端点
@app.get("/api/search")
async def search_wiki(q: str = Query(..., min_length=1), limit: int = 20):
    from tools.search_engine import get_engine
    engine = get_engine()
    
    # Phase 1: FTS5 宽召回
    fts_results = engine.search(q, limit=limit * 2)
    
    # Phase 2: Fuse.js 精排（可选，前端也可处理）
    return {"results": fts_results[:limit], "total": len(fts_results)}
```

**Step 3: 前端集成**

```typescript
// wiki-viewer/src/services/dataService.ts
export async function searchWiki(query: string, limit = 20): Promise<SearchResult[]> {
  const response = await fetch(
    `${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  const data = await response.json();
  return data.results;
}
```

**Step 4: 索引维护**

```python
# 在 ingest.py 完成摄入后自动调用
from tools.search_engine import get_engine

def after_ingest(page_path: Path):
    engine = get_engine()
    # ... 读取页面元数据 ...
    engine.index_page(path=page_path, title=..., content=..., ...)
```

### 3.4 Phase 2: 可选语义层（Ollama）

```python
# tools/search_engine.py 新增
import litellm

class SemanticSearch:
    def embed(self, text: str) -> list[float]:
        response = litellm.embedding(
            model="ollama/nomic-embed-text",
            input=[text],
            api_base="http://localhost:11434",
        )
        return response.data[0]["embedding"]
    
    def search(self, query: str, limit: int = 20) -> list[dict]:
        query_embedding = self.embed(query)
        # 查询 SQLite-vss 或本地向量存储
        ...
```

### 3.5 Risk & Mitigation

| 风险 | 缓解 |
|------|------|
| SQLite FTS5 中文分词差 | 使用 `unicode61` tokenizer，或升级到 `jieba` 自定义 tokenizer |
| 索引与文件不同步 | 在 ingest/refresh/delete 操作后自动触发增量索引更新 |
| 索引文件膨胀 | `wiki/` 下 1000 页面的索引约 10–20MB，可接受 |

---

## 四、整合 3：自动化工作流 — 从手动到事件驱动

> **战略价值**：⭐⭐⭐⭐ | **实现难度**：🔧🔧 | **维护成本**：💰💰 | **用户可见**：👁👁👁

### 4.1 Why

当前 Wiki 是"手动驱动"的：用户放文件 → 运行 ingest → 查询。竞品 `llm-wiki` 有文件 watcher 自动重索引，`MeMex` 有后台 worker，`casper` 有完整 pipeline。自动化是将 Wiki 从"工具"升级为"基础设施"的关键。

### 4.2 三层自动化架构

```
Layer 1: 文件层自动化（本地）
├── Watch raw/ 目录 ──→ 自动 ingest/refresh
└── 防抖 5 秒

Layer 2: 集成层自动化（外部触发）
├── Webhook API ──→ n8n / GitHub Actions / 浏览器扩展
├── RSS 监控 ──→ 新文章自动摄入
└── arXiv 监控 ──→ 新论文自动摄入

Layer 3: 智能层自动化（Agent 驱动）
├── 后台 lint（定时）
├── 后台 graph rebuild（定时）
└── AI 每日摘要（定时）
```

### 4.3 Implementation

**Layer 1: 文件 Watcher**

```python
# tools/watcher.py
#!/usr/bin/env python3
from __future__ import annotations

import sys
import time
import subprocess
from pathlib import Path
from collections import defaultdict

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
except ImportError:
    print("pip install watchdog", file=sys.stderr)
    sys.exit(1)

REPO_ROOT = Path(__file__).parent.parent
RAW_DIR = REPO_ROOT / "raw"

# 防抖：5 秒内多次变更合并为一次
debounce_timers = {}

def run_ingest(file_path: Path):
    result = subprocess.run(
        [sys.executable, str(REPO_ROOT / "tools" / "ingest.py"), str(file_path)],
        capture_output=True,
        text=True,
    )
    print(f"[ingest] {file_path.name}: rc={result.returncode}")
    if result.stderr:
        print(result.stderr, file=sys.stderr)

class RawFileHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return
        self._debounce(event.src_path, "created")
    
    def on_modified(self, event):
        if event.is_directory:
            return
        self._debounce(event.src_path, "modified")
    
    def _debounce(self, path: str, action: str):
        import threading
        
        def delayed():
            file_path = Path(path)
            if action == "created" or action == "modified":
                run_ingest(file_path)
        
        # 取消之前的定时器
        if path in debounce_timers:
            debounce_timers[path].cancel()
        
        timer = threading.Timer(5.0, delayed)
        debounce_timers[path] = timer
        timer.start()


def main():
    RAW_DIR.mkdir(exist_ok=True)
    
    observer = Observer()
    handler = RawFileHandler()
    observer.schedule(handler, str(RAW_DIR), recursive=True)
    observer.start()
    
    print(f"[watcher] Monitoring {RAW_DIR}")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()


if __name__ == "__main__":
    main()
```

**Layer 2: Webhook API**

```python
# api_server.py 新增
from pydantic import BaseModel, HttpUrl

class ClipPayload(BaseModel):
    url: HttpUrl
    title: str = ""
    tags: list[str] = []
    notes: str = ""

@app.post("/api/webhook/clip")
async def webhook_clip(payload: ClipPayload):
    """接收网页剪藏请求，使用 Jina Reader 转换为 Markdown。"""
    import httpx
    
    # Jina Reader 提取
    jina_url = f"https://r.jina.ai/{payload.url}"
    async with httpx.AsyncClient() as client:
        response = await client.get(jina_url, timeout=30)
        markdown = response.text
    
    # 保存到 raw/
    from datetime import datetime
    slug = re.sub(r"[^\w-]", "-", str(payload.url))[:50]
    filename = f"clipped-{slug}-{datetime.now().strftime('%Y%m%d')}.md"
    file_path = REPO_ROOT / "raw" / "clipped" / filename
    file_path.parent.mkdir(exist_ok=True)
    
    header = f"---\ntitle: \"{payload.title or 'Clipped Page'}\"\n"
    header += f"type: source\ntags: {payload.tags}\n"
    header += f"source_url: {payload.url}\ndate: {datetime.now().isoformat()}\n---\n\n"
    header += f"> Notes: {payload.notes}\n\n" if payload.notes else ""
    
    file_path.write_text(header + markdown, encoding="utf-8")
    
    # 触发 ingest（Watcher 会自动处理，但也可以直接调用）
    return {
        "success": True,
        "saved_to": str(file_path),
        "chars": len(markdown),
    }


@app.post("/api/webhook/github")
async def webhook_github(request: Request):
    """GitHub push webhook：自动 ingest raw/ 目录变更。"""
    payload = await request.json()
    
    if payload.get("ref") != "refs/heads/main":
        return {"ignored": "not main branch"}
    
    ingested = []
    for commit in payload.get("commits", []):
        for f in commit.get("added", []) + commit.get("modified", []):
            if f.startswith("raw/"):
                file_path = REPO_ROOT / f
                if file_path.exists():
                    # 异步触发 ingest
                    import asyncio
                    asyncio.create_task(async_ingest(file_path))
                    ingested.append(f)
    
    return {"ingested": ingested}
```

**Layer 3: GitHub Action 模板**

```yaml
# .github/workflows/auto-ingest.yml
name: Auto Ingest Wiki
on:
  push:
    paths: ['raw/**']

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: pip install -r requirements.txt
      
      - name: Get changed files
        id: changed
        uses: tj-actions/changed-files@v44
        with:
          files: raw/**
      
      - name: Ingest changed files
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          LLM_MODEL: ${{ vars.LLM_MODEL }}
        run: |
          for file in ${{ steps.changed.outputs.all_changed_files }}; do
            echo "Ingesting $file"
            python tools/ingest.py "$file"
          done
      
      - name: Commit updated wiki
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add wiki/ graph/ wiki/log.md
          git diff --cached --quiet || git commit -m "auto: ingest ${{ steps.changed.outputs.all_changed_files }}"
          git push
```

### 4.4 Risk & Mitigation

| 风险 | 缓解 |
|------|------|
| Watch 模式触发过于频繁 | 防抖 5 秒 + SHA256 变化检测 |
| GitHub Action API 成本 | 只处理 `raw/` 变更，其他路径跳过 |
| Webhook 安全问题 | 添加简单 token 验证（后期可升级为 HMAC） |

---

## 五、整合 4：可视化增强 — 从网络图到多维视图

> **战略价值**：⭐⭐⭐⭐ | **实现难度**：🔧🔧🔧 | **维护成本**：💰 | **用户可见**：👁👁👁👁👁

### 5.1 Why

当前只有 vis-network 力导向图。知识可视化的维度可以大大扩展：思维导图展示层级关系、时间线展示演进、仪表盘展示健康度。这些都是竞品完全没有的维度，是本项目的**差异化护城河**。

### 5.2 思维导图（Markmap）

**实现**：

```tsx
// wiki-viewer/src/pages/MindMapPage.tsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Markmap } from "markmap-view";
import { Transformer } from "markmap-lib";

const transformer = new Transformer();

export function MindMapPage() {
  const { slug } = useParams();
  const [markdown, setMarkdown] = useState("");
  
  useEffect(() => {
    // 获取页面内容并构建思维导图结构
    fetchPageContent(slug).then(content => {
      const mindmapMd = buildMindmapMarkdown(content, 3);
      setMarkdown(mindmapMd);
    });
  }, [slug]);
  
  useEffect(() => {
    if (!markdown) return;
    const { root } = transformer.transform(markdown);
    const svg = document.getElementById("mindmap");
    if (svg) {
      const mm = Markmap.create(svg, { autoFit: true }, root);
      mm.fit();
    }
  }, [markdown]);
  
  return <svg id="mindmap" style={{ width: "100%", height: "80vh" }} />;
}

function buildMindmapMarkdown(content: string, depth: number): string {
  // 以当前页面为中心，[[wikilinks]] 为子节点
  // 递归展开 depth 层
  // 输出 markmap 兼容的 Markdown
  ...
}
```

**路由配置**：

```tsx
// App.tsx
<Route path="/mindmap/:slug" element={<MindMapPage />} />
```

### 5.3 知识时间线（vis-timeline）

```tsx
// wiki-viewer/src/pages/TimelinePage.tsx
import { Timeline } from "vis-timeline/standalone";
import { useEffect, useRef } from "react";

export function TimelinePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // 解析 log.md
    const events = parseLogEntries();
    
    const items = events.map(e => ({
      id: e.id,
      content: `${e.operation}: ${e.title}`,
      start: e.date,
      type: "point",
      className: `timeline-${e.operation}`,
    }));
    
    const timeline = new Timeline(containerRef.current, items, {}, {
      height: "80vh",
      zoomMin: 1000 * 60 * 60 * 24, // 1 day
      zoomMax: 1000 * 60 * 60 * 24 * 365, // 1 year
    });
    
    timeline.on("select", (props) => {
      const event = events.find(e => e.id === props.items[0]);
      if (event) showEventDetail(event);
    });
    
    return () => timeline.destroy();
  }, []);
  
  return <div ref={containerRef} />;
}
```

### 5.4 健康仪表盘（最小可行版）

```tsx
// wiki-viewer/src/pages/DashboardPage.tsx
import { useEffect, useState } from "react";

interface WikiStats {
  totalPages: number;
  sources: number;
  entities: number;
  concepts: number;
  orphanedPages: number;
  brokenLinks: number;
  avgLinksPerPage: number;
  recentActivity: number; // 7天内操作数
}

export function DashboardPage() {
  const [stats, setStats] = useState<WikiStats | null>(null);
  
  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(setStats);
  }, []);
  
  if (!stats) return <div>Loading...</div>;
  
  return (
    <div className="dashboard-grid">
      <StatCard title="总页面数" value={stats.totalPages} icon="📄" />
      <StatCard title="实体页面" value={stats.entities} icon="🏢" />
      <StatCard title="概念页面" value={stats.concepts} icon="💡" />
      <StatCard title="孤立页面" value={stats.orphanedPages} 
                alert={stats.orphanedPages > 5} />
      <StatCard title="断链数" value={stats.brokenLinks}
                alert={stats.brokenLinks > 0} />
      <StatCard title="平均链接密度" value={stats.avgLinksPerPage.toFixed(1)} />
      <StatCard title="7天活跃度" value={stats.recentActivity} icon="🔥" />
    </div>
  );
}
```

**后端 API**：

```python
@app.get("/api/stats")
async def wiki_stats():
    pages = all_wiki_pages()
    
    total = len(pages)
    sources = sum(1 for p in pages if p.get("type") == "source")
    entities = sum(1 for p in pages if p.get("type") == "entity")
    concepts = sum(1 for p in pages if p.get("type") == "concept")
    
    # 计算孤立页面（无入链）
    all_links = []
    for p in pages:
        content = read_file(p["path"])
        all_links.extend(extract_wikilinks(content))
    
    linked_pages = set(all_links)
    orphaned = [p for p in pages if p.get("title") not in linked_pages]
    
    return {
        "totalPages": total,
        "sources": sources,
        "entities": entities,
        "concepts": concepts,
        "orphanedPages": len(orphaned),
        "brokenLinks": 0,  # 需要 lint 数据
        "avgLinksPerPage": len(all_links) / max(total, 1),
        "recentActivity": count_recent_log_entries(days=7),
    }
```

### 5.5 Risk & Mitigation

| 风险 | 缓解 |
|------|------|
| Markmap 大页面性能差 | 限制递归深度为 3 层，提供"加载更多"按钮 |
| vis-timeline 数据量大 | 按月份聚合，默认显示最近 3 个月 |
| 仪表盘 API 慢 | 缓存统计结果，每 5 分钟刷新 |

---

## 六、整合 5：Agent Memory — 从 Wiki 到持久记忆层

> **战略价值**：⭐⭐⭐⭐⭐ | **实现难度**：🔧🔧🔧🔧 | **维护成本**：💰💰 | **用户可见**：👁👁

### 6.1 Why

当前 Agent 每次对话都是"session zero"——不保留跨会话上下文。`claude-mem`（67K stars）证明跨会话记忆是刚需。如果 Wiki 能成为 Agent 的持久记忆层，每次对话时 Agent 先读取相关记忆，再回答，体验将质的飞跃。

### 6.2 Architecture

```
用户对话
    │
    ▼
Agent（Claude/GPT/Gemini）
    │
    ├── 查询 Wiki 记忆（MCP wiki_search / wiki_read）
    │   └── 获取：历史决策、项目上下文、用户偏好
    │
    ├── 生成回答
    │
    └── 写入新知识（MCP wiki_write）
    │   └── 会话摘要、新决策、更新上下文
    │
    ▼
下次对话 → Wiki 更丰富了 → Agent 更聪明了
```

### 6.3 Implementation

**Step 1: 记忆目录结构**

```
wiki/
└── memory/
    ├── sessions/
    │   ├── 2026-05-04-001-claude.md
    │   └── 2026-05-04-002-cursor.md
    ├── decisions.md          # 跨会话决策日志
    ├── preferences.md        # 用户偏好
    ├── projects.md           # 活跃项目索引
    └── context-packs/
        ├── pack-api-design.md
        └── pack-auth-refactor.md
```

**Step 2: Agent Memory Python API**

```python
# tools/memory.py
from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).parent.parent
MEMORY_DIR = REPO_ROOT / "wiki" / "memory"


class AgentMemory:
    def __init__(self):
        MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        (MEMORY_DIR / "sessions").mkdir(exist_ok=True)
        (MEMORY_DIR / "context-packs").mkdir(exist_ok=True)
    
    def start_session(self, agent: str, goal: str, 
                      target: str = None) -> str:
        """开始新会话，创建记忆文件。"""
        session_id = f"{datetime.now().strftime('%Y-%m-%d')}-{uuid.uuid4().hex[:4]}"
        file_path = MEMORY_DIR / "sessions" / f"{session_id}-{agent}.md"
        
        content = f"""---
session_id: {session_id}
agent: {agent}
started_at: {datetime.now().isoformat()}
status: active
goal: {goal}
target: {target or ''}
---

## Goal
{goal}

## Progress

## Decisions Made

## Changed Files

## Notes
"""
        file_path.write_text(content, encoding="utf-8")
        return session_id
    
    def update_session(self, session_id: str, notes: str = "",
                       decisions: list[str] = None,
                       changed_paths: list[str] = None):
        """更新会话进度。"""
        # 查找对应的会话文件
        session_files = list((MEMORY_DIR / "sessions").glob(f"{session_id}*.md"))
        if not session_files:
            return False
        
        file_path = session_files[0]
        content = file_path.read_text(encoding="utf-8")
        
        if notes:
            content += f"\n- [{datetime.now().strftime('%H:%M')}] {notes}\n"
        
        if decisions:
            for d in decisions:
                content += f"\n- **Decision**: {d}\n"
                # 同时写入 decisions.md
                self._append_decision(d, session_id)
        
        if changed_paths:
            for p in changed_paths:
                content += f"\n- Changed: `{p}`\n"
        
        file_path.write_text(content, encoding="utf-8")
        return True
    
    def finish_session(self, session_id: str, summary: str):
        """完成会话，写入摘要。"""
        session_files = list((MEMORY_DIR / "sessions").glob(f"{session_id}*.md"))
        if not session_files:
            return False
        
        file_path = session_files[0]
        content = file_path.read_text(encoding="utf-8")
        content += f"\n\n## Summary\n{summary}\n\n---\nstatus: completed\nfinished_at: {datetime.now().isoformat()}\n"
        file_path.write_text(content, encoding="utf-8")
        return True
    
    def get_context(self, query: str, limit: int = 5) -> list[dict]:
        """获取与查询相关的记忆上下文。"""
        # 搜索 sessions + decisions + preferences
        results = []
        for file_path in MEMORY_DIR.rglob("*.md"):
            content = file_path.read_text(encoding="utf-8")
            if query.lower() in content.lower():
                # 提取摘要
                lines = content.split("\n")
                excerpt = "\n".join(lines[:10])
                results.append({
                    "path": str(file_path.relative_to(REPO_ROOT)),
                    "excerpt": excerpt,
                    "relevance": content.lower().count(query.lower()),
                })
        
        results.sort(key=lambda x: x["relevance"], reverse=True)
        return results[:limit]
    
    def _append_decision(self, decision: str, session_id: str):
        decisions_file = MEMORY_DIR / "decisions.md"
        entry = f"\n- [{datetime.now().strftime('%Y-%m-%d')}] {decision} (session: {session_id})\n"
        if decisions_file.exists():
            content = decisions_file.read_text(encoding="utf-8")
        else:
            content = "# Decision Log\n\n"
        content += entry
        decisions_file.write_text(content, encoding="utf-8")


# 便捷函数
def get_memory() -> AgentMemory:
    return AgentMemory()
```

**Step 3: Context Packs**

```python
# tools/context.py
from __future__ import annotations

from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).parent.parent


class ContextPackBuilder:
    """构建 token-bounded 上下文包，供 Agent 快速加载。"""
    
    def build(self, goal: str, target: str = None, 
              budget: int = 8000) -> dict:
        """
        1. 从目标页面出发，图谱遍历 2-hop 找到相关节点
        2. 混合搜索补充相关页面
        3. 按新鲜度 + 相关度排序
        4. 截断到 budget tokens（约 1 token ≈ 4 chars）
        5. 生成带引用的上下文包
        """
        char_budget = budget * 4
        
        # Step 1: 图谱遍历
        graph_pages = self._graph_traversal(target, depth=2)
        
        # Step 2: 搜索补充
        search_pages = self._search_relevant(goal, limit=10)
        
        # Step 3: 合并去重，按相关度排序
        all_pages = {p["path"]: p for p in graph_pages + search_pages}
        sorted_pages = sorted(all_pages.values(), 
                              key=lambda x: x.get("relevance", 0), 
                              reverse=True)
        
        # Step 4: 截断
        context = []
        used_chars = 0
        for page in sorted_pages:
            content = page.get("content", "")
            if used_chars + len(content) > char_budget:
                remaining = char_budget - used_chars
                content = content[:remaining] + "\n... [truncated]"
            context.append({
                "title": page.get("title"),
                "path": page.get("path"),
                "content": content,
            })
            used_chars += len(content)
            if used_chars >= char_budget:
                break
        
        return {
            "goal": goal,
            "target": target,
            "budget": budget,
            "pages_included": len(context),
            "estimated_tokens": used_chars // 4,
            "context": context,
        }
    
    def save_pack(self, pack: dict, name: str):
        """保存上下文包供后续复用。"""
        pack_dir = REPO_ROOT / "wiki" / "memory" / "context-packs"
        pack_dir.mkdir(parents=True, exist_ok=True)
        
        import json
        pack_path = pack_dir / f"{name}.json"
        pack_path.write_text(json.dumps(pack, indent=2, ensure_ascii=False), 
                             encoding="utf-8")
        return str(pack_path)
    
    def load_pack(self, name: str) -> Optional[dict]:
        """加载已保存的上下文包。"""
        pack_path = REPO_ROOT / "wiki" / "memory" / "context-packs" / f"{name}.json"
        if not pack_path.exists():
            return None
        import json
        return json.loads(pack_path.read_text(encoding="utf-8"))
    
    def _graph_traversal(self, target: str, depth: int) -> list[dict]:
        # 从 graph.json 读取节点和边，做 BFS
        ...
    
    def _search_relevant(self, query: str, limit: int) -> list[dict]:
        # 调用 search_engine
        ...
```

**Step 4: MCP 集成**

将 `memory.start_session` / `memory.update_session` / `memory.get_context` 暴露为 MCP 工具：

```python
@mcp.tool()
def memory_start(goal: str, agent: str = "claude", target: str = "") -> dict:
    mem = get_memory()
    session_id = mem.start_session(agent=agent, goal=goal, target=target)
    return {"session_id": session_id, "status": "started"}

@mcp.tool()
def memory_update(session_id: str, notes: str = "", 
                  decisions: list = None) -> dict:
    mem = get_memory()
    success = mem.update_session(session_id, notes=notes, decisions=decisions)
    return {"success": success}

@mcp.tool()
def memory_context(query: str, limit: int = 5) -> list[dict]:
    mem = get_memory()
    return mem.get_context(query, limit=limit)
```

### 6.4 Risk & Mitigation

| 风险 | 缓解 |
|------|------|
| 记忆文件膨胀 | 定期归档（>30 天的 session 移入 `memory/archive/`） |
| 敏感信息泄露 | `memory/` 目录默认加入 `.gitignore`，或单独配置 |
| Context Pack 过大 | 严格 token budget + 截断提示 |

---

## 七、决策树：何时选择哪个整合

```
你当前处于什么阶段？
│
├── 项目刚启动 / < 50 页面
│   └── 先做 整合 1 (MCP) + 整合 2 (搜索) → 建立核心能力
│
├── 已有用户反馈 / 100+ 页面
│   └── 加做 整合 3 (自动化) + 整合 4 (可视化) → 提升体验
│
├── 团队使用 / 多 Agent 协作
│   └── 必须做 整合 5 (Agent Memory) → 解决并发和上下文问题
│
└── 追求差异化 / 竞品同质化严重
    └── 深耕 整合 4 (可视化) + 探索 知识时间线 / 仪表盘 / 联邦

你有几天时间？
├── 1–3 天
│   └── Quick Wins: Docker Compose / PWA / URL 剪藏 / ETag 轮询
│
├── 1–2 周
│   └── 整合 2 (搜索) 或 整合 1 (MCP MVP)
│
├── 2–4 周
│   └── 整合 1 (完整 MCP) + 整合 3 (Watch + Webhook)
│
└── 1–3 月
    └── 全部 5 个整合 + Phase 2 语义层
```

---

## 八、整合实施检查清单

| 整合 | 前置条件 | 核心交付物 | 验证方式 |
|------|---------|-----------|---------|
| MCP Server | 无 | `tools/mcp_server.py` | `claude mcp test llm-wiki` |
| 混合搜索 | 无 | `tools/search_engine.py` | 搜索"LLM"返回"大语言模型"相关 |
| 自动化工作流 | API Server | `tools/watcher.py` + webhook | 放入 raw/ 文件自动出现在 wiki |
| 可视化增强 | 前端构建 | Markmap + Timeline + Dashboard | `/mindmap/Overview` 正常渲染 |
| Agent Memory | MCP Server | `tools/memory.py` + `tools/context.py` | 跨会话能读取之前的决策 |

---

## 九、参考文档

- `docs/competitive-analysis-2025.md` — 竞争短板分析与优化建议
- `docs/competitor-analysis-and-roadmap.md` — 竞品矩阵与技术路线图
- `docs/cross-domain-integration-brainstorm.md` — 8 维度整合思维
- `docs/competitive-landscape-2026-update.md` — 2026-04 wave 竞品情报
- `docs/strategic-roadmap-consolidated.md` — 合并后的统一路线图

---

> **核心结论：五大整合中，MCP Server 和混合搜索是「准入门槛」级别的必须项；自动化工作流和可视化增强是「差异化护城河」；Agent Memory 是「未来战场」。建议按 1→2→3→4→5 的顺序渐进实施，每个整合独立可交付，避免大瀑布式开发。**
