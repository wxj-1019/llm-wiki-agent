# LLM Wiki Agent — MCP Server 与 Skill 集成方案

> **版本**：v4.0（经 3 轮迭代）  
> **日期**：2026-05-02  
> **目标**：让 LLM Wiki Agent 支持 MCP Server 安装/管理和 Skill 创建/分发，使其成为一个完整的 AI Agent 知识平台

---

## 一、现状分析

### 1.1 已有能力

| 能力 | 实现位置 | 状态 |
|---|---|---|
| LLM 接入 | `config/llm.yaml` + `litellm` | ✅ 已完成 |
| Wiki Chat (RAG) | `api_server.py` → `/api/wiki-chat` | ✅ 已完成（SSE 流式） |
| Agent Kit 生成 | `tools/export_agent_kit.py` | ✅ 已完成 |
| LLM 辅助生成 MCP/Skill | `api_server.py` → `/api/agent-kit/generate-from-knowledge` | ✅ 已完成 |
| Agent Kit 文件管理 | `/api/agent-kit/files`, `save-file`, `download`, `download-zip` | ✅ 已完成 |
| LLM 配置管理 | `/api/llm-config` (GET/POST) | ✅ 已完成 |
| MCP SDK | `requirements.txt` → `mcp>=1.2.0` | ✅ 已安装 |
| Prompt 模板 | `requirements.txt` → `jinja2>=3.1.0` | ✅ 已安装 |

### 1.2 缺失能力

| 能力 | 说明 | 优先级 |
|---|---|---|
| **MCP Server 注册表** | 无 MCP Server 的安装、注册、生命周期管理 | P0 |
| **MCP 运行时** | 生成的 MCP Server 无法在应用内直接启动/停止 | P0 |
| **Skill 注册表** | 无 Skill 的安装、版本管理、依赖追踪 | P0 |
| **前端 MCP/Skill 管理 UI** | 无可视化界面管理已安装的 MCP/Skill | P1 |
| **MCP ↔ Wiki 联动** | MCP Server 无法直接读取 wiki 数据 | P1 |
| **Skill 冲突检测** | 多个 Skill 触发词重叠时无优先级仲裁 | P2 |
| **MCP/Skill 版本更新** | 已安装的 MCP/Skill 无版本升级机制 | P2 |

---

## 二、MCP Server 集成方案

### 2.1 架构设计

```
┌──────────────────────────────────────────────────────────┐
│                   LLM Wiki Agent                          │
│                                                           │
│  ┌──────────┐   ┌──────────────┐   ┌───────────────┐    │
│  │ Wiki 数据 │   │ MCP 运行时    │   │ Skill 引擎     │    │
│  │ (markdown)│   │ (ProcessMgr) │   │ (Executor)     │    │
│  └─────┬────┘   └──────┬───────┘   └───────┬───────┘    │
│        │               │                    │             │
│  ┌─────┴───────────────┴────────────────────┴──────────┐ │
│  │              FastAPI 统一 API 层                      │ │
│  │  /api/mcp/*           /api/skills/*                  │ │
│  │  /api/wiki-chat       /api/agent-kit/*               │ │
│  └────────────────────────┬────────────────────────────┘ │
│                           │                               │
│  ┌────────────────────────┴────────────────────────────┐ │
│  │            MCP Registry (JSON)                       │ │
│  │  mcp-servers/installed.json                          │ │
│  │  mcp-servers/{server-name}/                          │ │
│  │    ├── server.py       # MCP Server 入口             │ │
│  │    ├── config.json      # 运行配置                    │ │
│  │    ├── metadata.json    # 元数据                      │ │
│  │    └── requirements.txt # 独立依赖                    │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 2.2 MCP Server 注册表

**文件位置**：`mcp-servers/installed.json`

```json
{
  "version": 1,
  "servers": [
    {
      "name": "wiki-search",
      "display_name": "Wiki 知识搜索",
      "description": "搜索 wiki 知识库中的内容",
      "version": "1.0.0",
      "source": "generated",
      "status": "stopped",
      "port": null,
      "pid": null,
      "transport": "stdio",
      "tools": ["search_wiki", "get_page", "list_pages", "get_graph"],
      "installed_at": "2026-05-02T10:00:00",
      "updated_at": "2026-05-02T10:00:00",
      "health": {
        "last_check": null,
        "status": "unknown",
        "error_count": 0
      },
      "config": {
        "wiki_path": "../wiki",
        "max_memory_mb": 256,
        "auto_restart": true,
        "restart_cooldown_sec": 30
      }
    }
  ]
}
```

### 2.3 新增 API 端点

#### MCP 管理 API

| 端点 | 方法 | 说明 | 请求体 | 响应 |
|---|---|---|---|---|
| `/api/mcp/list` | GET | 列出所有已安装的 MCP Server | — | `{servers: [...]}` |
| `/api/mcp/install` | POST | 安装 MCP Server | `MCPInstallRequest` | `{name, status}` |
| `/api/mcp/uninstall/{name}` | DELETE | 卸载 MCP Server（自动停止） | — | `{status}` |
| `/api/mcp/start/{name}` | POST | 启动 MCP Server | — | `{pid, port, status}` |
| `/api/mcp/stop/{name}` | POST | 停止 MCP Server | — | `{status}` |
| `/api/mcp/status/{name}` | GET | 获取运行状态 | — | `{status, pid, memory, uptime}` |
| `/api/mcp/logs/{name}` | GET | 获取日志（最近 100 行） | `?lines=N` | `{logs: [...]}` |
| `/api/mcp/generate` | POST | 基于 wiki 知识生成 MCP Server | `{description, template}` | `{files: {...}}` |
| `/api/mcp/test/{name}` | POST | 测试连通性（调用 list_tools） | — | `{ok, tools: [...]}` |
| `/api/mcp/restart/{name}` | POST | 重启 MCP Server | — | `{pid, status}` |
| `/api/mcp/call/{name}/{tool}` | POST | 直接调用 MCP 工具 | `{arguments: {...}}` | `{result}` |

#### 安装请求体

```typescript
interface MCPInstallRequest {
  source: "npm" | "pip" | "url" | "local" | "generated";
  package?: string;
  url?: string;
  path?: string;
  name: string;
  config?: Record<string, unknown>;
}

interface MCPStatusResponse {
  name: string;
  status: "running" | "stopped" | "error" | "installing";
  pid: number | null;
  port: number | null;
  memory_mb: number | null;
  uptime_sec: number | null;
  tools: string[];
  health: {
    last_check: string | null;
    status: "healthy" | "degraded" | "down";
    error_count: number;
  };
}
```

### 2.4 MCP Server 模板

项目内置 3 个 MCP Server 模板，可一键生成：

#### 模板 A：Wiki 知识搜索 MCP

```python
import json
from pathlib import Path
from mcp.server.fastmcp import FastMCP

REPO = Path(__file__).parent.parent.parent
WIKI = REPO / "wiki"

mcp = FastMCP("wiki-search")

@mcp.tool()
def search_wiki(query: str) -> str:
    """搜索 wiki 知识库中的内容，返回匹配的页面列表"""
    results = []
    q = query.lower()
    for p in WIKI.rglob("*.md"):
        if p.name in ("index.md", "log.md", "lint-report.md", "health-report.md"):
            continue
        content = p.read_text(encoding="utf-8")
        if q in content.lower():
            rel = p.relative_to(WIKI)
            preview = content[:200].replace("\n", " ")
            results.append({"id": str(rel.with_suffix("")), "preview": preview})
    return json.dumps(results[:20], ensure_ascii=False)

@mcp.tool()
def get_page(page_type: str, slug: str) -> str:
    """获取 wiki 页面的完整 markdown 内容"""
    path = WIKI / page_type / f"{slug}.md"
    if not path.exists() or not path.is_relative_to(WIKI):
        return json.dumps({"error": f"Page not found: {page_type}/{slug}"})
    return path.read_text(encoding="utf-8")

@mcp.tool()
def list_pages(page_type: str = "") -> str:
    """列出 wiki 页面，可按类型过滤（sources/entities/concepts/syntheses）"""
    search_dir = WIKI / page_type if page_type else WIKI
    if not search_dir.exists():
        return json.dumps({"error": f"Invalid type: {page_type}"})
    pages = []
    for p in search_dir.rglob("*.md"):
        if p.name in ("index.md", "log.md"):
            continue
        rel = p.relative_to(WIKI)
        pages.append(str(rel.with_suffix("")))
    return json.dumps(pages, ensure_ascii=False)

@mcp.tool()
def get_graph() -> str:
    """获取知识图谱的节点和边数据"""
    graph_path = REPO / "graph" / "graph.json"
    if not graph_path.exists():
        return json.dumps({"error": "Graph not built yet. Run build_graph first."})
    return graph_path.read_text(encoding="utf-8")

if __name__ == "__main__":
    mcp.run()
```

#### 模板 B：文件系统 MCP

```python
from pathlib import Path
from mcp.server.fastmcp import FastMCP

REPO = Path(__file__).parent.parent.parent
RAW = REPO / "raw"

mcp = FastMCP("filesystem")

@mcp.tool()
def list_raw_files() -> str:
    """列出 raw/ 目录下所有源文件"""
    files = [str(p.relative_to(REPO)) for p in RAW.rglob("*") if p.is_file()]
    return "\n".join(files)

@mcp.tool()
def read_raw_file(path: str) -> str:
    """读取 raw/ 目录下的源文件内容"""
    target = (REPO / path).resolve()
    if not target.is_relative_to(RAW.resolve()):
        return "Error: path traversal denied"
    if not target.exists():
        return f"Error: file not found: {path}"
    return target.read_text(encoding="utf-8", errors="replace")

if __name__ == "__main__":
    mcp.run()
```

#### 模板 C：Agent 操作 MCP

```python
import subprocess
import sys
from pathlib import Path
from mcp.server.fastmcp import FastMCP

REPO = Path(__file__).parent.parent.parent

mcp = FastMCP("agent-tools")

@mcp.tool()
def ingest_document(path: str) -> str:
    """摄入文档到 wiki 知识库"""
    result = subprocess.run(
        [sys.executable, str(REPO / "tools" / "ingest.py"), str(REPO / path)],
        capture_output=True, text=True, cwd=str(REPO), timeout=300,
    )
    return result.stdout[-2000:] if result.returncode == 0 else f"Error: {result.stderr[-500:]}"

@mcp.tool()
def build_graph() -> str:
    """构建/重建知识图谱"""
    result = subprocess.run(
        [sys.executable, str(REPO / "tools" / "build_graph.py")],
        capture_output=True, text=True, cwd=str(REPO), timeout=600,
    )
    return result.stdout[-2000:] if result.returncode == 0 else f"Error: {result.stderr[-500:]}"

@mcp.tool()
def run_health_check() -> str:
    """运行 wiki 健康检查"""
    result = subprocess.run(
        [sys.executable, str(REPO / "tools" / "health.py"), "--json"],
        capture_output=True, text=True, cwd=str(REPO), timeout=30,
    )
    return result.stdout[-2000:] if result.returncode == 0 else f"Error: {result.stderr[-500:]}"

if __name__ == "__main__":
    mcp.run()
```

### 2.5 MCP 安装流程

```
POST /api/mcp/install
    │
    ├─ source=pip     → pip install {package} → 验证入口 → 复制到 mcp-servers/{name}/
    ├─ source=url     → git clone {url} → pip install -r requirements.txt → 验证入口
    ├─ source=local   → 路径安全校验 → symlink → 验证入口
    └─ source=generated → /api/agent-kit/generate-from-knowledge → LLM 生成 → 保存
    │
    ├─ 验证入口：检查 server.py 是否存在 + FastMCP 实例是否可导入
    ├─ 写入 installed.json
    ├─ 安装独立依赖（requirements.txt in server dir）
    └─ 可选：POST /api/mcp/start/{name}
```

### 2.6 MCP 运行时管理器

```python
import os
import sys
import json
import subprocess
import threading
import time
import psutil
from pathlib import Path
from typing import Optional

class MCPManager:
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.registry_path = base_dir / "installed.json"
        self.processes: dict[str, subprocess.Popen] = {}
        self.log_buffers: dict[str, list[str]] = {}
        self.max_servers = int(os.getenv("MCP_MAX_SERVERS", "5"))
        self._load_registry()
        atexit.register(self.stop_all)

    def _load_registry(self):
        if self.registry_path.exists():
            self.registry = json.loads(self.registry_path.read_text(encoding="utf-8"))
        else:
            self.registry = {"version": 1, "servers": []}

    def _save_registry(self):
        self.registry_path.write_text(
            json.dumps(self.registry, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    def install(self, name: str, source: str, **kwargs) -> dict:
        if len([s for s in self.registry["servers"]]) >= self.max_servers:
            return {"error": f"Maximum {self.max_servers} servers limit reached"}
        server_dir = self.base_dir / name
        if source == "generated":
            server_dir.mkdir(parents=True, exist_ok=True)
        elif source == "pip":
            subprocess.run([sys.executable, "-m", "pip", "install", kwargs["package"]],
                          capture_output=True, timeout=120)
        elif source == "url":
            subprocess.run(["git", "clone", kwargs["url"], str(server_dir)],
                          capture_output=True, timeout=120)
            req_file = server_dir / "requirements.txt"
            if req_file.exists():
                subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(req_file)],
                              capture_output=True, timeout=120)
        entry = {
            "name": name, "status": "stopped", "port": None, "pid": None,
            "installed_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "health": {"last_check": None, "status": "unknown", "error_count": 0},
        }
        self.registry["servers"].append(entry)
        self._save_registry()
        return {"name": name, "status": "installed"}

    def start(self, name: str) -> dict:
        server_dir = self.base_dir / name
        server_file = server_dir / "server.py"
        if not server_file.exists():
            return {"error": f"Server not found: {name}"}
        proc = subprocess.Popen(
            [sys.executable, str(server_file)],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            cwd=str(server_dir),
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
        )
        self.processes[name] = proc
        self.log_buffers[name] = []
        self._update_registry(name, "running", proc.pid)
        self._start_log_reader(name, proc)
        return {"pid": proc.pid, "status": "running"}

    def stop(self, name: str) -> dict:
        proc = self.processes.pop(name, None)
        if proc and proc.poll() is None:
            if sys.platform == "win32":
                proc.kill()
            else:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
        self._update_registry(name, "stopped", None)
        return {"status": "stopped"}

    def status(self, name: str) -> dict:
        proc = self.processes.get(name)
        if proc and proc.poll() is None:
            try:
                mem = psutil.Process(proc.pid).memory_info().rss / 1024 / 1024
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                mem = None
            return {"status": "running", "pid": proc.pid, "memory_mb": round(mem, 1) if mem else None}
        return {"status": "stopped", "pid": None, "memory_mb": None}

    def logs(self, name: str, lines: int = 100) -> dict:
        buf = self.log_buffers.get(name, [])
        return {"logs": buf[-lines:]}

    def test(self, name: str) -> dict:
        status = self.status(name)
        if status["status"] != "running":
            return {"ok": False, "error": "Server not running"}
        return {"ok": True, "message": "Server process is alive"}

    def stop_all(self):
        for name in list(self.processes.keys()):
            self.stop(name)

    def _update_registry(self, name: str, status: str, pid):
        for s in self.registry["servers"]:
            if s["name"] == name:
                s["status"] = status
                s["pid"] = pid
                s["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                break
        self._save_registry()

    def _start_log_reader(self, name: str, proc: subprocess.Popen):
        def reader():
            for line in proc.stdout:
                decoded = line.decode("utf-8", errors="replace").rstrip()
                self.log_buffers[name].append(decoded)
                if len(self.log_buffers[name]) > 1000:
                    self.log_buffers[name] = self.log_buffers[name][-500:]
        t = threading.Thread(target=reader, daemon=True)
        t.start()
```

---

## 三、Skill 系统集成方案

### 3.1 架构设计

```
┌──────────────────────────────────────────────────────────┐
│                      Skill 引擎                           │
│                                                           │
│  ┌───────────────┐  ┌─────────────────────────────────┐  │
│  │ Skill 注册表    │  │ Skill 模板库                     │  │
│  │ skills/         │  │ templates/                       │  │
│  │  installed.json │  │  wiki-query/                     │  │
│  │  {skill}/       │  │  document-ingest/               │  │
│  │   SKILL.md      │  │  knowledge-graph/               │  │
│  │   config.json   │  │  mcp-generator/                 │  │
│  │   prompts/      │  │  github-analyzer/               │  │
│  │   actions/      │  │  content-lint/                   │  │
│  │   tests/        │  │  export-kit/                     │  │
│  └───────┬────────┘  └─────────────────────────────────┘  │
│          │                                                 │
│  ┌───────┴──────────────────────────────────────────────┐ │
│  │                   Skill 执行器                         │ │
│  │                                                       │ │
│  │  ① TriggerMatcher — 匹配触发词，解决冲突              │ │
│  │  ② ContextCollector — RAG 检索 wiki 相关页面         │ │
│  │  ③ PromptRenderer   — Jinja2 渲染 system + user      │ │
│  │  ④ LLMCaller        — litellm.completion (SSE)       │ │
│  │  ⑤ PostProcessor    — 解析 wikilinks, 保存结果       │ │
│  │  ⑥ TelemetryCollector — 记录执行指标                  │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Skill 规范

每个 Skill 由以下文件组成：

```
skills/{skill-name}/
├── SKILL.md          # 技能描述（必需）— YAML frontmatter + Markdown
├── config.json       # 配置文件（必需）
├── prompts/          # Prompt 模板
│   ├── system.md     # 系统提示词（Jinja2 模板）
│   └── user.md       # 用户提示词模板（Jinja2 模板）
├── actions/          # 可执行动作（可选）
│   └── action.py     # Python 脚本
└── tests/            # 测试（可选）
    └── test_skill.py
```

#### SKILL.md 格式

```markdown
---
name: wiki-query
version: 1.0.0
author: llm-wiki-agent
description: 基于 wiki 知识库回答用户问题
tags: [query, rag, knowledge]
priority: 10
requires:
  - litellm
  - wiki-data
---

# Wiki Query Skill

## Description
搜索 wiki 知识库中的相关页面，综合回答用户问题。

## Usage
- 触发词：用户提出关于 wiki 内容的问题
- 输入：自然语言问题
- 输出：带 [[wikilinks]] 引用的综合答案

## Workflow
1. 解析用户问题，提取关键词
2. 搜索 wiki 中相关页面（使用 /api/search）
3. 提取相关片段
4. 调用 LLM 综合回答
5. 可选：保存为 synthesis 页面

## Example Prompts
- "Transformer 架构的核心创新是什么？"
- "OpenAI 和 Google 在 LLM 领域有什么关系？"
- "总结一下 wiki 中关于 AI Agent 的内容"
```

#### config.json 格式

```json
{
  "name": "wiki-query",
  "version": "1.0.0",
  "type": "rag",
  "triggers": ["query:", "wiki:"],
  "priority": 10,
  "model": "default",
  "max_tokens": 4096,
  "context_size": 5,
  "auto_save": true,
  "save_path": "syntheses/",
  "timeout_sec": 60,
  "parameters": {
    "temperature": 0.3,
    "search_method": "keyword",
    "max_context_pages": 10
  },
  "permissions": {
    "read_wiki": true,
    "write_wiki": true,
    "read_raw": false,
    "execute_commands": false,
    "network_access": false
  }
}
```

### 3.3 内置 Skill 模板

| Skill | 触发方式 | 类型 | 功能 |
|---|---|---|---|
| `wiki-query` | `query: <问题>` | rag | RAG 问答 |
| `document-ingest` | `ingest <文件>` | action | 文档摄入 |
| `knowledge-graph` | `build graph` | action | 构建知识图谱 |
| `mcp-generator` | `generate mcp <描述>` | generator | 生成 MCP Server |
| `github-analyzer` | `analyze github <repo>` | pipeline | 分析 GitHub 项目并摄入 |
| `content-lint` | `lint` | action | 内容质量检查 |
| `export-kit` | `export kit` | action | 导出 Agent Kit |

### 3.4 Skill 触发词冲突仲裁

当多个 Skill 的触发词匹配时，按以下规则仲裁：

```
1. 精确匹配优先于前缀匹配（`query:` 精确 > `?` 前缀）
2. priority 数值越大优先级越高（默认 0）
3. 同优先级按使用频率排序（usage_count 降序）
4. 仍然冲突则返回候选列表让用户选择
```

### 3.5 Skill 执行引擎

```python
import json
import time
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
import litellm
import os

class SkillEngine:
    def __init__(self, skills_dir: Path, wiki_dir: Path):
        self.skills_dir = skills_dir
        self.wiki_dir = wiki_dir
        self.registry = self._load_registry()

    def match_trigger(self, user_input: str) -> list[dict]:
        candidates = []
        for skill in self.registry["skills"]:
            if not skill.get("enabled", True):
                continue
            config = self._load_skill_config(skill["name"])
            for trigger in config.get("triggers", []):
                if user_input.lower().startswith(trigger.lower()):
                    candidates.append({"skill": skill, "config": config, "match": trigger})
        candidates.sort(key=lambda c: c["config"].get("priority", 0), reverse=True)
        return candidates

    def execute(self, name: str, user_input: str, stream: bool = True):
        config = self._load_skill_config(name)
        skill_dir = self.skills_dir / name
        context_pages = self._collect_context(user_input, config)
        system_prompt = self._render_prompt(skill_dir, "system.md", {
            "wiki_context": context_pages,
            "config": config,
        })
        user_prompt = self._render_prompt(skill_dir, "user.md", {
            "input": user_input,
            "wiki_context": context_pages,
        })
        model = config.get("model", "default")
        if model == "default":
            model = os.getenv("LLM_MODEL", "claude-3-5-sonnet-latest")
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        if stream:
            return self._stream_call(model, messages, config)
        else:
            return self._sync_call(model, messages, config)

    def _collect_context(self, query: str, config: str) -> list[dict]:
        max_pages = config.get("parameters", {}).get("max_context_pages", 5)
        results = []
        q = query.lower()
        for p in self.wiki_dir.rglob("*.md"):
            if p.name in ("index.md", "log.md", "lint-report.md", "health-report.md"):
                continue
            content = p.read_text(encoding="utf-8")
            if q in content.lower():
                results.append({"path": str(p.relative_to(self.wiki_dir)), "content": content})
                if len(results) >= max_pages:
                    break
        return results

    def _render_prompt(self, skill_dir: Path, template_name: str, context: dict) -> str:
        prompts_dir = skill_dir / "prompts"
        if not (prompts_dir / template_name).exists():
            return ""
        env = Environment(loader=FileSystemLoader(str(prompts_dir)))
        template = env.get_template(template_name)
        return template.render(**context)

    def _stream_call(self, model: str, messages: list, config: dict):
        def generator():
            for chunk in litellm.completion(
                model=model,
                messages=messages,
                max_tokens=config.get("max_tokens", 4096),
                temperature=config.get("parameters", {}).get("temperature", 0.3),
                stream=True,
            ):
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield f"data: {json.dumps({'content': delta}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return generator()

    def _sync_call(self, model: str, messages: list, config: dict) -> str:
        response = litellm.completion(
            model=model, messages=messages,
            max_tokens=config.get("max_tokens", 4096),
            temperature=config.get("parameters", {}).get("temperature", 0.3),
        )
        return response.choices[0].message.content

    def _load_skill_config(self, name: str) -> dict:
        config_path = self.skills_dir / name / "config.json"
        if config_path.exists():
            return json.loads(config_path.read_text(encoding="utf-8"))
        return {}

    def _load_registry(self) -> dict:
        reg_path = self.skills_dir / "installed.json"
        if reg_path.exists():
            return json.loads(reg_path.read_text(encoding="utf-8"))
        return {"version": 1, "skills": []}
```

### 3.6 新增 API 端点

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/skills/list` | GET | 列出所有已安装的 Skill |
| `/api/skills/install` | POST | 安装 Skill（从 URL/本地/生成） |
| `/api/skills/uninstall/{name}` | DELETE | 卸载 Skill |
| `/api/skills/enable/{name}` | POST | 启用 Skill |
| `/api/skills/disable/{name}` | POST | 禁用 Skill |
| `/api/skills/execute/{name}` | POST | 执行 Skill（SSE 流式） |
| `/api/skills/match` | POST | 匹配触发词，返回候选 Skill |
| `/api/skills/generate` | POST | 基于 wiki 知识生成新 Skill |
| `/api/skills/templates` | GET | 列出可用的 Skill 模板 |
| `/api/skills/detail/{name}` | GET | 获取 Skill 详情（含 SKILL.md） |
| `/api/skills/save/{name}` | PUT | 保存编辑后的 Skill 文件 |

---

## 四、前端管理界面设计

### 4.1 新增页面

| 页面 | 路由 | 功能 |
|---|---|---|
| MCP 管理 | `/mcp` | 已安装 Server 列表、安装/卸载、启动/停止、状态监控 |
| Skill 管理 | `/skills` | 已安装 Skill 列表、安装/卸载、启用/禁用、执行 |
| Skill 编辑器 | `/skills/:name/edit` | 在线编辑 Skill 的 SKILL.md、config.json、prompts |
| MCP 生成器 | `/mcp/generate` | 向导式生成 MCP Server |
| Skill 生成器 | `/skills/generate` | 向导式生成 Skill |

### 4.2 MCP 管理页面组件

```
<MCPPage>
  <MCPHeader />
  <MCPStatusBar />                    // 运行中/总数、内存使用、端口占用
  <MCPInstallDialog />                // 安装对话框（pip/url/生成 三个 Tab）
  <MCPServerList>
    <MCPServerCard>
      <StatusIndicator />             // 绿/红/灰 状态灯
      <ServerMeta />                  // 名称、版本、描述、来源
      <ToolList />                    // 暴露的 tools 列表（可折叠）
      <MemoryUsage />                 // 实时内存使用
      <LogViewer />                   // 最近日志（可展开）
      <ActionButtons />               // 启动/停止/重启/测试/卸载
    </MCPServerCard>
  </MCPServerList>
</MCPPage>
```

### 4.3 Skill 管理页面组件

```
<SkillsPage>
  <SkillsHeader />
  <SkillCategoryTabs />               // 全部/内置/自定义/生成
  <SkillInstallDialog />
  <SkillGrid>
    <SkillCard>
      <SkillIcon />                   // 类型图标（🔍/📥/🕸️/⚙️）
      <SkillMeta />                   // 名称、版本、描述
      <TriggerBadge />                // 触发词标签
      <UsageStats />                  // 使用次数、最后使用时间
      <ToggleSwitch />                // 启用/禁用
      <ActionButtons />               // 执行/编辑/卸载
    </SkillCard>
  </SkillGrid>
</SkillsPage>
```

### 4.4 MCP 生成向导流程

```
Step 1: 选择模板
  ┌─────────────────────────────────────┐
  │  [Wiki 搜索]  [文件系统]  [Agent 操作] │
  │  [从零开始 - 自定义]                   │
  └─────────────────────────────────────┘

Step 2: 配置
  - 名称 / 描述
  - 需要暴露的工具（勾选）
  - 运行参数（内存限制、自动重启）

Step 3: 生成
  - LLM 基于模板 + wiki 知识生成代码
  - 实时预览生成的 server.py
  - 可手动编辑

Step 4: 测试 & 安装
  - 一键测试连通性
  - 确认安装到 mcp-servers/
```

### 4.5 Skill 编辑器

```
<SkillEditorPage>
  <SkillBreadcrumb />
  <TabGroup>
    <Tab name="SKILL.md">
      <MonacoEditor language="markdown" />
    </Tab>
    <Tab name="config.json">
      <MonacoEditor language="json" />
    </Tab>
    <Tab name="prompts/system.md">
      <MonacoEditor language="markdown" />
    </Tab>
    <Tab name="prompts/user.md">
      <MonacoEditor language="markdown" />
    </Tab>
  </TabGroup>
  <EditorActions>
    <SaveButton />
    <TestButton />                     // 用测试输入执行一次
    <PreviewButton />                  // 预览渲染后的 Prompt
  </EditorActions>
</SkillEditorPage>
```

---

## 五、安全设计

### 5.1 路径安全

```python
SAFE_DIRS = [RAW.resolve(), WIKI.resolve(), GRAPH.resolve()]

def validate_path(requested_path: str) -> Path:
    target = (REPO / requested_path).resolve()
    for safe_dir in SAFE_DIRS:
        if target.is_relative_to(safe_dir):
            return target
    raise ValueError(f"Path traversal denied: {requested_path}")
```

### 5.2 MCP 进程沙箱

| 限制 | 实现 |
|---|---|
| 内存限制 | `psutil` 监控，超 256MB 自动 stop + restart |
| CPU 限制 | `subprocess` 优先级设为 BELOW_NORMAL |
| 文件访问 | 仅允许访问 `wiki/`、`raw/`、`graph/` 目录 |
| 网络访问 | 可选：通过 `--no-network` 标志限制 |
| 最大进程数 | 环境变量 `MCP_MAX_SERVERS=5` |
| 超时自动停止 | 空闲 30 分钟无调用自动停止 |

### 5.3 Skill 权限模型

```json
{
  "permissions": {
    "read_wiki": true,
    "write_wiki": false,
    "read_raw": false,
    "execute_commands": false,
    "network_access": false
  }
}
```

执行前检查权限：`write_wiki=false` 的 Skill 不能调用 `ingest`、`save-file` 等。

### 5.4 生成代码审计

LLM 生成的 MCP/Skill 代码在安装前经过安全检查：
- 禁止 `os.system()`、`subprocess.call()` 中使用 shell=True
- 禁止 `eval()`、`exec()`、`__import__()`
- 禁止访问环境变量中的 API Key
- 强制使用 `is_relative_to()` 验证路径

---

## 六、测试计划

### 6.1 后端测试

| 测试类型 | 覆盖范围 | 工具 |
|---|---|---|
| MCP Manager 单元测试 | install/start/stop/status/logs | pytest |
| Skill Engine 单元测试 | trigger matching/prompt rendering/execution | pytest |
| API 集成测试 | 所有 MCP/Skill API 端点 | httpx + pytest |
| 安全测试 | 路径遍历、权限检查、进程隔离 | pytest |
| 进程管理测试 | 启动/停止/崩溃恢复/内存限制 | pytest + psutil |

### 6.2 前端测试

| 测试类型 | 覆盖范围 | 工具 |
|---|---|---|
| 组件测试 | MCPServerCard、SkillCard、对话框 | Vitest + RTL |
| 页面测试 | MCPPage、SkillsPage 路由和交互 | Vitest + RTL |
| E2E 测试 | 安装→启动→调用→停止 全流程 | Playwright |

### 6.3 测试场景

```python
def test_mcp_install_and_start(tmp_path):
    mgr = MCPManager(tmp_path)
    result = mgr.install("test-server", source="generated")
    assert result["status"] == "installed"

    result = mgr.start("test-server")
    assert result["status"] == "running"

    status = mgr.status("test-server")
    assert status["status"] == "running"
    assert status["pid"] is not None

    result = mgr.stop("test-server")
    assert result["status"] == "stopped"

def test_skill_trigger_matching(skills_dir):
    engine = SkillEngine(skills_dir, Path("wiki"))
    matches = engine.match_trigger("query: what is transformer?")
    assert len(matches) >= 1
    assert matches[0]["skill"]["name"] == "wiki-query"

def test_path_traversal_blocked():
    with pytest.raises(ValueError, match="path traversal denied"):
        validate_path("../../etc/passwd")
```

---

## 七、目录结构变更

```
llm-wiki-agent/
├── mcp-servers/                    # 新增
│   ├── installed.json
│   ├── wiki-search/
│   │   ├── server.py
│   │   ├── config.json
│   │   ├── metadata.json
│   │   └── requirements.txt
│   ├── filesystem/
│   │   ├── server.py
│   │   ├── config.json
│   │   ├── metadata.json
│   │   └── requirements.txt
│   └── agent-tools/
│       ├── server.py
│       ├── config.json
│       ├── metadata.json
│       └── requirements.txt
├── skills/                         # 新增
│   ├── installed.json
│   ├── wiki-query/
│   │   ├── SKILL.md
│   │   ├── config.json
│   │   └── prompts/
│   │       ├── system.md
│   │       └── user.md
│   ├── document-ingest/
│   ├── knowledge-graph/
│   ├── mcp-generator/
│   ├── github-analyzer/
│   ├── content-lint/
│   └── export-kit/
├── tools/
│   ├── api_server.py               # 增强
│   ├── mcp_manager.py              # 新增
│   ├── skill_engine.py             # 新增
│   └── ...
├── wiki-viewer/src/
│   ├── components/pages/
│   │   ├── MCPPage.tsx             # 新增
│   │   ├── SkillsPage.tsx          # 新增
│   │   ├── SkillEditorPage.tsx     # 新增
│   │   └── ...
│   ├── components/mcp/             # 新增
│   │   ├── MCPServerCard.tsx
│   │   ├── MCPInstallDialog.tsx
│   │   └── MCPGenerateWizard.tsx
│   ├── components/skills/          # 新增
│   │   ├── SkillCard.tsx
│   │   ├── SkillInstallDialog.tsx
│   │   ├── SkillGenerateWizard.tsx
│   │   └── SkillEditor.tsx
│   └── ...
├── tests/                          # 新增
│   ├── test_mcp_manager.py
│   ├── test_skill_engine.py
│   └── test_api_mcp_skills.py
```

---

## 八、实现步骤

### Phase 1：MCP 基础设施（3-4 天）

| 步骤 | 任务 | 交付物 |
|---|---|---|
| 1.1 | 创建 `mcp-servers/` 目录和注册表结构 | `mcp-servers/installed.json` |
| 1.2 | 实现 3 个内置 MCP Server | `wiki-search/`, `filesystem/`, `agent-tools/` |
| 1.3 | 实现 `tools/mcp_manager.py` 运行时管理器 | 进程启停、状态查询、日志、内存监控 |
| 1.4 | 在 `api_server.py` 中添加 MCP 管理 API | `/api/mcp/*` 11 个端点 |
| 1.5 | 前端 MCP 管理页面 | `MCPPage.tsx` + 3 个组件 |
| 1.6 | MCP Manager 单元测试 | `test_mcp_manager.py` |

### Phase 2：Skill 系统（3-4 天）

| 步骤 | 任务 | 交付物 |
|---|---|---|
| 2.1 | 创建 `skills/` 目录和注册表结构 | `skills/installed.json` |
| 2.2 | 实现 7 个内置 Skill | SKILL.md + config.json + prompts |
| 2.3 | 实现 `tools/skill_engine.py` 执行引擎 | 触发匹配、Prompt 渲染、LLM 调用、后处理 |
| 2.4 | 在 `api_server.py` 中添加 Skill 管理 API | `/api/skills/*` 11 个端点 |
| 2.5 | 前端 Skill 管理页面 | `SkillsPage.tsx` + 4 个组件 |
| 2.6 | Skill Engine 单元测试 | `test_skill_engine.py` |

### Phase 3：生成器与编辑器（2-3 天）

| 步骤 | 任务 | 交付物 |
|---|---|---|
| 3.1 | MCP 生成向导（前端） | 4 步向导组件 |
| 3.2 | Skill 生成向导（前端） | 4 步向导组件 |
| 3.3 | Skill 在线编辑器 | Monaco Editor + 实时预览 |
| 3.4 | MCP/Skill 测试功能 | 一键测试 + 结果展示 |

### Phase 4：集成测试与文档（1-2 天）

| 步骤 | 任务 | 交付物 |
|---|---|---|
| 4.1 | 端到端测试 | 安装→启动→调用→停止 全流程 |
| 4.2 | 安全测试 | 路径遍历、权限、进程隔离 |
| 4.3 | 更新 AGENTS.md | 添加 MCP/Skill 工作流说明 |
| 4.4 | 更新 wiki-viewer 路由和导航 | Sidebar 添加 MCP/Skill 入口 |

---

## 九、验收标准

### 功能验收

| 编号 | 验收项 | 标准 |
|---|---|---|
| F-01 | MCP Server 安装 | 支持 pip/url/本地/生成 4 种安装方式 |
| F-02 | MCP Server 启停 | 启动/停止/状态查询均正常，进程隔离 |
| F-03 | MCP Server 调用 | 通过 API 调用 MCP 工具，返回正确结果 |
| F-04 | MCP Server 测试 | 一键测试连通性，返回工具列表 |
| F-05 | Skill 安装 | 支持 url/本地/生成 3 种安装方式 |
| F-06 | Skill 执行 | 输入→RAG 检索→LLM 生成→输出 全流程正常 |
| F-07 | Skill 启用/禁用 | 禁用后不响应触发词 |
| F-08 | Skill 触发词冲突 | 多 Skill 匹配时按优先级自动选择 |
| F-09 | MCP 生成器 | 描述需求后 LLM 生成可运行的 MCP Server |
| F-10 | Skill 生成器 | 描述需求后 LLM 生成完整的 Skill 文件 |
| F-11 | Skill 在线编辑器 | 可编辑并保存 SKILL.md/config/prompts |
| F-12 | 前端管理 UI | 所有操作均可在前端完成，无需命令行 |

### 非功能验收

| 编号 | 验收项 | 标准 |
|---|---|---|
| NF-01 | MCP 进程隔离 | Server 崩溃不影响主 API 服务 |
| NF-02 | 安全校验 | 所有路径操作验证不逃逸项目目录 |
| NF-03 | 资源限制 | MCP Server 内存 ≤ 256MB，超限自动停止 |
| NF-04 | 日志记录 | 所有 MCP/Skill 操作写入 wiki/log.md |
| NF-05 | Windows 兼容 | 进程管理在 Windows 上正常工作 |
| NF-06 | 测试覆盖 | 核心模块测试覆盖率 ≥ 80% |
| NF-07 | API 响应时间 | 列表/状态查询 ≤ 200ms |

---

## 十、风险预案

| 风险 | 概率 | 影响 | 预案 |
|---|---|---|---|
| MCP Server 进程泄漏 | 中 | 高 | atexit 清理 + 僵尸进程定时检测 + 最大进程数限制 |
| 生成的代码有安全风险 | 中 | 高 | 安全校验规则 + 路径验证 + 权限模型 + 审计提示词 |
| litellm 不支持 Function Calling | 低 | 中 | 降级为纯文本 Prompt 模式 |
| Windows 进程管理兼容性 | 中 | 低 | CREATE_NEW_PROCESS_GROUP + taskkill |
| MCP Server 端口冲突 | 低 | 中 | 端口自动分配（8100-8200）+ 检测占用 |
| Skill 触发词冲突 | 中 | 低 | 优先级仲裁 + 候选列表让用户选择 |
| 依赖冲突（各 MCP Server） | 低 | 中 | 每个 Server 独立 venv 或 requirements.txt |

---

## 十一、依赖与配置

### 新增 Python 依赖

```
# requirements.txt 新增
psutil>=5.9.0        # 进程管理和内存监控
```

`mcp` 和 `jinja2` 已在现有 `requirements.txt` 中。

### 环境变量

```bash
MCP_MAX_SERVERS=5
MCP_PORT_RANGE=8100-8200
MCP_MEMORY_LIMIT_MB=256
MCP_IDLE_TIMEOUT_MIN=30
SKILLS_DIR=skills
MCP_SERVERS_DIR=mcp-servers
```

---

## 十二、上线后监测指标

| 指标 | 采集方式 | 告警阈值 |
|---|---|---|
| MCP Server 可用率 | `/api/mcp/status` 定时检查 | < 95% |
| MCP 调用延迟 | API 中间件记录 | p95 > 5s |
| MCP 内存使用 | psutil 监控 | > 200MB |
| Skill 执行成功率 | 执行结果统计 | < 90% |
| Skill 执行延迟 | API 中间件记录 | p95 > 30s |
| Skill 触发匹配率 | match API 统计 | < 80%（说明触发词设计有问题） |
| 生成代码质量 | 用户反馈 + 测试通过率 | 测试通过率 < 70% |
