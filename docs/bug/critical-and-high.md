# Critical & High Severity Bugs

## CRITICAL (3)

### C1: `build_graph.py:354` — NameError: `existing_edge_summary` 变量未定义导致语义推理崩溃

- **文件**: `tools/build_graph.py`
- **行号**: 354 (以及 343)
- **严重程度**: **CRITICAL**

**问题描述**:
`build_inferred_edges()` 函数在第343行使用 f-string 构建LLM prompt:

```python
prompt = f"""
...
Already-extracted edges from this page:
{existing_edge_summary}
...
"""
```

但变量 `existing_edge_summary` 在整个函数中从未被赋值。当Python评估这个f-string时，会抛出 `NameError: name 'existing_edge_summary' is not defined`，导致整个语义推理Pass 2崩溃。这意味着任何启用推理的 `build_graph.py` 运行都会在此处失败。

**修复建议**:
在循环内（第342行之后）计算 `existing_edge_summary`:

```python
edges_for_page = [e for e in existing_edges if e["from"] == src]
existing_edge_summary = "\n".join(
    f"- {e['from']} -> {e['to']} ({e.get('type', 'EXTRACTED')})"
    for e in edges_for_page
) if edges_for_page else "(none)"
```

---

### C2: `scheduler.py:33` — `cmd.split()` 在Windows路径含空格时崩溃

- **文件**: `tools/scheduler.py`
- **行号**: 33
- **严重程度**: **CRITICAL**

**问题描述**:
调度器使用 `cmd.split()` 来解析要执行的命令，例如:

```python
cmd = f"{sys.executable} tools/fetchers/rss_fetcher.py"
subprocess.run(cmd.split(), ...)
```

在Windows上，如果Python安装在 `C:\Program Files\Python311\python.exe`，`split()` 会错误地将路径分割为 `['C:\\Program', 'Files\\Python311\\python.exe', ...]`，导致调度器无法启动任何任务。

**修复建议**:
使用列表形式传递命令参数:

```python
subprocess.run([sys.executable, "tools/fetchers/rss_fetcher.py"], ...)
```

---

### C3: `wikiStore.ts:76` — 未声明变量 `_persistTimer`

- **文件**: `wiki-viewer/src/stores/wikiStore.ts`
- **行号**: 76-77
- **严重程度**: **CRITICAL**

**问题描述**:
`persistState` 函数使用了 `_persistTimer` 变量，但该变量从未被声明:

```typescript
function persistState(state: WikiState) {
  if (_persistTimer) clearTimeout(_persistTimer);   // _persistTimer 未声明!
  _persistTimer = setTimeout(() => writePersist(state), 500);
}
```

文件中声明了 `_initPromise`, `_pollInterval`, `_lastEtag`, `_pollFetching`, `_readingTimestamps`，但没有 `_persistTimer`。在TypeScript严格模式下这会编译失败。即使编译通过，首次调用时 `_persistTimer` 为 `undefined`，`clearTimeout(undefined)` 会静默成功，但之后 `setTimeout` 的返回值被赋给了未声明的全局变量（在非严格模式下），或直接抛出 `ReferenceError`（严格模式）。

**修复建议**:
在文件顶部添加声明:

```typescript
let _persistTimer: ReturnType<typeof setTimeout> | null = null;
```

---

## HIGH (14)

### H1: `ingest.py:105-107, 170-173` — 函数重复定义覆盖共享模块导入

- **文件**: `tools/ingest.py`
- **行号**: 105-107, 170-173
- **严重程度**: **HIGH**

**问题描述**:
第51-59行通过 `try/except ImportError` 从 `tools.shared.wiki` 导入或定义 `read_file` 和 `write_file` 的fallback版本。但第105-107行无条件重新定义了 `read_file`，第170-173行无条件重新定义了 `write_file`（且增加了print行为），完全覆盖了共享模块的实现。

**修复建议**:
删除第105-107行和170-173行的无条件重定义。

---

### H2: `ingest.py:166-167` — `call_llm` 可能返回None导致 `AttributeError`

- **文件**: `tools/ingest.py`
- **行号**: 166-167, 456-458
- **严重程度**: **HIGH**

**问题描述**:
`call_llm` 的fallback实现中 `response.choices[0].message.content` 可能返回 `None`（例如模型只返回tool calls时）。然后在第458行调用 `parse_json_from_response(raw)` 会执行 `text.strip()` 导致 `AttributeError: 'NoneType' object has no attribute 'strip'`。

**修复建议**:
在第456行后添加检查:

```python
if raw is None:
    raise IngestError("LLM returned empty response")
```

---

### H3: `query.py:218-219` — LLM返回路径的路径遍历漏洞

- **文件**: `tools/query.py`
- **行号**: 218-219
- **严重程度**: **HIGH**

**问题描述**:
当LLM返回相关页面路径列表时，代码直接将路径与 `WIKI_DIR` 拼接:

```python
relevant_pages = [WIKI_DIR / p for p in paths if (WIKI_DIR / p).exists()]
```

如果LLM返回 `../../etc/passwd` 之类的路径，且该文件恰好在系统中存在，其内容会被读取并包含在查询上下文中，造成数据泄露。

**修复建议**:
对每个路径进行遍历检查:

```python
relevant = []
for p in paths:
    cand = (WIKI_DIR / p).resolve()
    try:
        cand.relative_to(WIKI_DIR.resolve())
    except ValueError:
        continue
    if cand.exists():
        relevant.append(cand)
```

---

### H4: `heal.py:217` — 实体名称中的特殊字符导致YAML注入

- **文件**: `tools/heal.py`
- **行号**: 217
- **严重程度**: **HIGH**

**问题描述**:
prompt模板使用f-string将实体名直接嵌入YAML:

```python
title: "{entity}"
```

如果实体名为 `He said "hello"`，生成的YAML是 `title: "He said "hello""`，这是无效YAML，会导致解析失败。

**修复建议**:
先转义实体名:

```python
safe_entity_name = entity.replace('\\', '\\\\').replace('"', '\\"')
```

---

### H5: `mcp_manager.py:220` — `start()` 等方法缺少名称验证，可遍历路径

- **文件**: `tools/mcp_manager.py`
- **行号**: 220-221
- **严重程度**: **HIGH**

**问题描述**:
`start()`, `stop()`, `restart()`, `status()`, `logs()`, `test()`, `call_tool()` 等方法接受 `name` 参数但没有验证。攻击者可以传入 `../../../evil` 来执行系统任意位置的 `server.py` 文件。

`install()` 和 `uninstall()` 虽然调用了 `_SAFE_NAME_RE.match`，但其他方法完全没有检查。

**修复建议**:
在所有接受 `name` 参数的public方法中添加名称验证。

---

### H6: `multimodal_ingest.py:49` — Google Gemini API Key嵌入URL查询字符串

- **文件**: `tools/multimodal_ingest.py`
- **行号**: 49
- **严重程度**: **HIGH**

**问题描述**:
```python
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key={key}"
```

API key在URL中会被代理服务器、负载均衡器和HTTP日志记录。应使用 `x-goog-api-key` HTTP头传递。

**修复建议**:
将key作为请求头传递，而非URL参数。

---

### H7: `context.py:40` — 路径遍历检查使用字符串前缀匹配，可被绕过

- **文件**: `tools/context.py`
- **行号**: 40
- **严重程度**: **HIGH**

**问题描述**:
```python
if not str(target).startswith(str(WIKI.resolve())):
    return None
```

如果 `WIKI` 解析为 `/home/user/wiki`，则 `/home/user/wiki-evil` 会通过此检查但位于wiki目录之外。

**修复建议**:
```python
try:
    target.relative_to(WIKI.resolve())
except ValueError:
    return None
```

---

### H8: `api_server.py:147-168` — 内存速率限制器存在竞态条件

- **文件**: `tools/api_server.py`
- **行号**: 147-168
- **严重程度**: **HIGH**

**问题描述**:
`_rate_limit_store` 是一个普通 `defaultdict`，在异步中间件中无锁访问。多个并发请求可以:
1. 同时遍历和删除过期key（第159-161行），可能导致 `RuntimeError: dictionary changed size during iteration`
2. 同时读写列表导致计数不准确

**修复建议**:
使用 `asyncio.Lock()` 保护对 `_rate_limit_store` 的访问。

---

### H9: `api_server.py:635-650` — `/api/multimodal/describe` 临时文件泄漏

- **文件**: `tools/api_server.py`
- **行号**: 635-650
- **严重程度**: **HIGH**

**问题描述**:
```python
tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
```
创建的文件永远不会被删除。注释说 "Keep temp file for potential debugging; cleanup is OS responsibility"。在长时间运行的服务器中，大量图片上传会导致系统临时目录被填满。

**修复建议**:
使用 `delete=True`（默认值），或定期清理旧临时文件。

---

### H10: `requirements.txt` — 缺少关键依赖

- **文件**: `requirements.txt`
- **严重程度**: **HIGH**

**问题描述**:
`requirements.txt` 缺少以下在 `pyproject.toml` 中声明的依赖:
- `markitdown[all]` — ingest.py, file_to_md.py 需要
- `tqdm` — 进度条功能需要
- `schedule` — scheduler.py 需要

Docker镜像和通过 `pip install -r requirements.txt` 安装的用户都会遇到 `ModuleNotFoundError`。

**修复建议**:
在 `requirements.txt` 中添加:
```
markitdown[all]>=0.1.5
tqdm>=4.67.3
schedule>=1.2.0
```

---

### H11: `agent_kit/triage.py:22-30` — 图节点slug与页面slug格式不匹配

- **文件**: `tools/agent_kit/triage.py`
- **行号**: 22-30
- **严重程度**: **HIGH**

**问题描述**:
图节点使用带前缀的路径（如 `concepts/Transformer`）作为key，而页面字典使用裸stem（如 `Transformer`）作为key:

```python
p0 = {s: pages[s] for s in p0_slugs if s in pages}
```

由于格式不匹配，`p0` 只会包含 `"overview"` 一个条目——所有高度数节点被静默丢弃。

**修复建议**:
使用 `_normalize_slug()` 函数（与 `skill_generator.py:18` 相同）来统一slug格式。

---

### H12: `wiki-viewer/src/components/editor/CollabEditor.tsx:26-27` — Yjs文档未随docId变化重建

- **文件**: `wiki-viewer/src/components/editor/CollabEditor.tsx`
- **行号**: 26-27
- **严重程度**: **HIGH**

**问题描述**:
Yjs `Doc` 实例在 `useMemo` 中创建且依赖数组为空（或不包含 `docId`）。当用户在编辑模式下切换文档时，Yjs文档不会重建，导致内容混淆或损坏。

**修复建议**:
```typescript
const doc = useMemo(() => new Y.Doc(), [docId]);
```

---

### H13: `restart_servers.py` — 使用 `kill -9` 强制终止进程

- **文件**: `restart_servers.py`
- **严重程度**: **HIGH**

**问题描述**:
脚本使用 `kill -9`（Windows上为 `taskkill /F`）强制终止服务器进程，不给进程执行优雅关闭的机会。这可能导致:
- 数据丢失（未写入的数据）
- SQLite WAL文件损坏
- 文件写入不完整

**修复建议**:
先发送 SIGTERM / 正常终止信号，等待超时后再使用 SIGKILL。

---

### H14: `file_to_md.py` — 缺少符号链接和递归深度边界检查

- **文件**: `tools/file_to_md.py`
- **严重程度**: **HIGH**

**问题描述**:
目录遍历没有检查符号链接，也没有递归深度限制。恶意构造的目录结构（循环符号链接）会导致无限循环。

**修复建议**:
添加符号链接检测和最大递归深度限制。
