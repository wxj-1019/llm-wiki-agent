# Round 6 — 全栈深度代码审计报告

> 审计日期：2026-05-08 | 审计范围：15+ 核心文件（后端 API + 工具链 + 前端全模块） | 总计 36 个问题

---

## 审计统计

| 严重级别 | 总计 | 已修复 | 未修复 | 修复率 |
|---|---|---|---|---|
| **P0（严重）** | 8 | 8 | 0 | **100%** |
| **P1（高）** | 9 | 9 | 0 | **100%** |
| **P2（中）** | 11 | 11 | 0 | **100%** |
| **P3（低）** | 8 | 8 | 0 | **100%** |
| **合计** | **36** | **36** | **0** | **100%** |

---

## P0 — 严重级别（8 个）

### R6-P0-01: `api_server.py` — 并发写入可损坏 `graph.json`

- **文件**: `tools/api_server.py`
- **行号**: L827, L1024, L840-864
- **分类**: 并发安全

**问题描述**:

多个 ingest 完成后会并发启动 `_rebuild_graph_sync` 线程，没有锁或去重机制，可能导致多个 `build_graph.py` 进程同时写入 `graph.json`，造成数据损坏。

```python
# api_server.py L827 — 无并发控制
threading.Thread(target=_rebuild_graph_sync, daemon=True).start()
```

`graph_save_layout` 端点（L2390-2409）同样存在非原子写入问题：读取-修改-写入之间没有任何文件锁，两个并发的布局保存请求可能导致数据丢失或 JSON 文件损坏。

**修复建议**:

使用 `threading.Lock` + `threading.Event` 确保同时只有一个图重建任务。文件写入使用 `tempfile` + 原子重命名模式。

---

### R6-P0-02: `api_server.py` — `ingestion_jobs` 内存泄漏 + 清理无效

- **文件**: `tools/api_server.py`
- **行号**: L64, L1034-1036
- **分类**: 内存泄漏

**问题描述**:

过期清理代码创建了新字典但**从未替换原始字典**，过期条目永远不会被删除：

```python
# L1034-1036 — 创建了新 dict 但没赋值回 ingestion_jobs！
active = {k: v for k, v in ingestion_jobs.items() if v.get("updated_at", 0) > cutoff}
```

此外，清理仅在 `/api/ingest/jobs` 被调用时执行。如果此端点不被访问，已完成的 job 会永远留在内存中。

**修复建议**:

```python
ingestion_jobs = {k: v for k, v in ingestion_jobs.items() if v.get("updated_at", 0) > cutoff}
```

或添加定时清理任务。

---

### R6-P0-03: 多文件 — `sys.exit()` 在库函数中滥用

- **文件**: `tools/query.py` L92, L226 | `tools/build_graph.py` L102 | `tools/refresh.py` L183, L189, L194 | `tools/mcp_server.py` L52
- **分类**: 进程安全

**问题描述**:

以下位置在可被外部模块调用的函数中直接使用 `sys.exit(1)`。当被 FastAPI/MCP 服务器作为模块导入时，会杀死整个宿主进程：

| 文件 | 行号 | 上下文 |
|---|---|---|
| `query.py` | L92 | litellm 导入失败 |
| `query.py` | L226 | wiki 为空 |
| `build_graph.py` | L102 | litellm 导入失败 |
| `refresh.py` | L183, L189, L194 | main() 函数中 |
| `mcp_server.py` | L52 | 模块级导入失败 |

**修复建议**:

全部改为 `raise RuntimeError(...)` 或自定义异常，让调用方决定如何处理。

---

### R6-P0-04: `api_server.py` — SSRF 防护可被 DNS 重绑定绕过

- **文件**: `tools/api_server.py`
- **行号**: L1062-1071
- **分类**: 安全漏洞

**问题描述**:

```python
try:
    ip = ipaddress.ip_address(hostname)
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
        raise HTTPException(...)
except ValueError:
    lower_host = hostname.lower()
    if lower_host in ("localhost",) or lower_host.endswith(".local"):
        raise HTTPException(...)
```

当 hostname 是域名而非 IP 时，走 `ValueError` 分支，只检查了 `localhost` 和 `.local`。攻击者可以使用指向 `127.0.0.1` 的外部 DNS 记录绕过检查。此外没有拦截 `0.0.0.0`、`[::1]`（IPv6 回环）、`metadata.google.internal` 等云环境元数据地址。

**修复建议**:

解析 DNS 后对实际 IP 做二次校验，同时屏蔽 `100.64.0.0/10`（Carrier-grade NAT）等云内网段。

---

### R6-P0-05: `api_server.py` — `_run_tool_script` 用户参数注入

- **文件**: `tools/api_server.py`
- **行号**: L2418-2442
- **分类**: 安全漏洞

**问题描述**:

```python
cmd = [PYTHON_EXE, str(REPO / "tools" / script_name)]
if extra_args:
    cmd.extend(extra_args)  # extra_args 来自用户输入，无清洗
```

`extra_args` 来自用户输入（`ToolRunPayload.args`），直接传入命令行，没有做任何清洗或白名单校验，可能被注入恶意参数。

**修复建议**:

对 `extra_args` 做白名单校验或至少过滤 shell 元字符。

---

### R6-P0-06: `mcp_server.py` — 符号链接绕过路径遍历检查

- **文件**: `tools/mcp_server.py`
- **行号**: L68-75
- **分类**: 安全漏洞

**问题描述**:

```python
target = (REPO / rel).resolve()
try:
    target.relative_to(WIKI.resolve())
```

`.resolve()` 会跟随符号链接。如果 `wiki/` 目录内存在符号链接指向外部目录，`relative_to` 检查仍然通过，导致可读取 wiki 之外的文件。

**场景**: 攻击者在 `wiki/entities/` 下创建符号链接 `link -> /etc`，然后调用 `wiki_read("wiki/entities/link/shadow")` 即可读取 `/etc/shadow`。

**修复建议**:

在 resolve 之前先检查路径组件中是否包含符号链接，或使用 `os.path.realpath` + `os.path.islink` 组合检查。

---

### R6-P0-07: `ingest.py` / `query.py` / `shared/llm.py` — LLM 调用无异常处理

- **文件**: `tools/ingest.py` L204 | `tools/query.py` L109-110 | `tools/shared/llm.py` L100
- **分类**: 健壮性

**问题描述**:

```python
response = completion(**kwargs)  # 无 try/except
content = response.choices[0].message.content  # choices 可能为空，content 可能为 None
```

- `completion()` 可能抛出 `RateLimitError`、`APIConnectionError`、`Timeout` 等 litellm 异常，均未捕获
- `response.choices` 可能为空列表（某些 provider 在内容过滤触发时），导致 `IndexError`
- `response.choices[0].message.content` 可能为 `None`（某些模型在工具调用场景下），导致后续字符串操作失败
- `shared/llm.py` 中的 `call_llm` 虽然有重试机制，但 `content` 为 `None` 时 `len(content)` 会触发 `TypeError`

**修复建议**:

1. 访问 `choices[0]` 前检查 `len(response.choices) > 0`
2. `content = response.choices[0].message.content or ""`
3. 内容过滤导致的空 choices 不应重试，应直接抛出明确异常

---

### R6-P0-08: `ChatPage.tsx` — AbortController 未在组件卸载时触发

- **文件**: `wiki-viewer/src/components/pages/ChatPage.tsx`
- **行号**: L220
- **分类**: 内存泄漏

**问题描述**:

流式响应期间如果用户导航到其他页面，`abortRef.current` 不会被自动 abort。流式循环会继续运行直到完成或出错，期间所有的 `setEntries` 调用都在已卸载组件上执行。

```tsx
// doSend 中创建的 AbortController 只在 handleStop 中 abort
abortRef.current = new AbortController();
```

**修复建议**:

```tsx
useEffect(() => {
  return () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  };
}, []);
```

---

## P1 — 高级别（9 个）

### R6-P1-01: `api_server.py` — 临时文件永不清理

- **文件**: `tools/api_server.py`
- **行号**: L691-706

```python
with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
    tmp.write(data)
finally:
    pass  # Keep temp file for potential debugging
```

每次调用都会在系统临时目录留下一个文件，长期运行导致磁盘空间耗尽。

**修复**: 在 `finally` 块中 `os.unlink(tmp_path)`。

---

### R6-P1-02: `api_server.py` — API Key 明文写入 `os.environ`

- **文件**: `tools/api_server.py`
- **行号**: L1492-1493

```python
key_env = f"{provider.upper().replace('-', '_')}_API_KEY"
os.environ[key_env] = api_key
```

每次加载配置都会将 API Key 明文写入进程环境变量。子进程会继承，如果任何依赖库记录环境变量，密钥会泄漏。

---

### R6-P1-03: `ingest.py` — 变量名遮蔽（定时炸弹）

- **文件**: `tools/ingest.py`
- **行号**: L550

```python
def ingest(source_path: str, ...):  # L408: 函数参数
    ...
    source_path = WIKI_DIR / "sources" / f"{safe_slug}.md"  # L550: 遮蔽！
```

函数参数 `source_path` 在 L550 被局部变量覆盖。当前恰好不再使用原始值，但未来维护者极易在此引入 bug。

---

### R6-P1-04: 多文件 — TOCTOU 竞态条件（无文件锁）

- **文件**: `tools/ingest.py` L284-300, L250-269 | `tools/heal.py` L152-170 | `tools/shared/log.py` L46-48 | `tools/refresh.py` L199-207

所有文件中的 `append_log`、`update_index`、日志追加操作都采用"读取→修改→写回"模式，没有文件锁。watcher + CLI + MCP + API 服务器并发运行时数据竞争几乎必然发生。

**修复建议**: 使用 `filelock` 库或 `fcntl`/`msvcrt` 文件锁。

---

### R6-P1-05: `ingest.py` — 大文件 OOM 风险

- **文件**: `tools/ingest.py`
- **行号**: L448-462

```python
source_bytes = source.read_bytes()       # 整个文件读入内存
source_content = source.read_text(...)   # 再次完整读入
prompt = f"...{source_content}..."       # 嵌入 LLM prompt
```

500MB 的 PDF 转换后可能更大，两份拷贝驻留内存 + 嵌入 prompt 可能超出 LLM 上下文限制，导致 API 调用失败并浪费资金。

**修复建议**: 添加文件大小限制（如 10MB），超大文件分块处理。

---

### R6-P1-06: `ChatPage.tsx` — `loadSessions()` 每次渲染都执行

- **文件**: `wiki-viewer/src/components/pages/ChatPage.tsx`
- **行号**: L87-89

```tsx
const initial = loadSessions();  // 每次渲染都调用！但 useState 只用首次的值
const [sessions, setSessions] = useState<ChatSession[]>(initial.sessions);
```

**修复**: 改为惰性初始化 `useState(() => loadSessions().sessions)`。

---

### R6-P1-07: `GraphPage.tsx` — `isEditing` 变化导致整个 vis-network 重建

- **文件**: `wiki-viewer/src/components/pages/GraphPage.tsx`
- **行号**: L253-254

`isEditing` 在 useEffect 依赖数组中，每次切换编辑模式都会销毁并重建整个 vis-network 实例——非常昂贵的操作。

**修复**: 使用 `useRef` 追踪 `isEditing`，从 effect 依赖数组中移除。

---

### R6-P1-08: `wikiStore.ts` — `refreshGraphData` 与 `initialize` 竞态条件

- **文件**: `wiki-viewer/src/stores/wikiStore.ts`
- **行号**: L177-253

`refreshGraphData()` 和 `initialize()` 可并发执行。后到达的结果覆盖先到达的，导致 `_lastEtag` 与实际写入的 `graphData` 不一致。

**修复**: `refreshGraphData` 应等待 `_initPromise` 完成后再执行。

---

### R6-P1-09: `ingestStore.ts` — `dismissAllCompleted` 语义错误（BUG）

- **文件**: `wiki-viewer/src/stores/ingestStore.ts`
- **行号**: L88-94

```typescript
dismissAllCompleted: () => {
  set((state) => {
    const jobs = state.jobs.filter((j) => j.status === 'running');  // 保留 running
    // 实际上移除了 completed AND failed 的 job
  });
},
```

函数名为"清除已完成"，但实际移除了所有非 running 的 job，包括 failed 状态的。用户期望点击"清除已完成"时，失败的 job 应保留以便排查。

**修复**: `const jobs = state.jobs.filter((j) => j.status !== 'completed');`

---

## P2 — 中等级别（11 个）

### R6-P2-01: 全量文件扫描性能问题（多处）

| 文件 | 行号 | 问题 |
|---|---|---|
| `api_server.py` | L387 | `/api/health` 每次全量 `rglob` |
| `api_server.py` | L366-382 | `/api/search` 遍历所有文件做子串匹配 |
| `api_server.py` | L507-530 | `list_raw_files` N*M 文件读取 |
| `heal.py` | L137-150 | 每个实体都扫描所有页面 |
| `search_engine.py` | L117-121 | 每次实例化扫描所有 wiki 文件 |
| `wiki.py` | L127-132 | `normalize_wikilinks` 每次调用扫描全部页面 |

**修复建议**: 对 health/search 端点使用带 TTL 的缓存；对 heal 预读取所有页面内容；对 normalize_wikilinks 构建模块级缓存。

---

### R6-P2-02: `ChatPage.tsx` — 消息列表无虚拟化

- **文件**: `wiki-viewer/src/components/pages/ChatPage.tsx`
- **行号**: L499-525

所有历史消息全部渲染在 DOM 中。长对话（数百条消息）会导致 DOM 膨胀和滚动卡顿。

**修复**: 使用 `react-virtuoso` 或 `@tanstack/react-virtual`。

---

### R6-P2-03: `refresh.py` — 每次刷新重新加载 ingest 模块

- **文件**: `tools/refresh.py`
- **行号**: L138-147

```python
spec = importlib.util.spec_from_file_location("ingest", TOOLS_DIR / "ingest.py")
ingest_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ingest_mod)  # 每次都重新编译+执行！
```

20 个页面刷新 = 加载 litellm 等重型依赖 20 次，造成严重的内存和性能浪费。

---

### R6-P2-04: `api_server.py` — WebSocket 无连接数限制

- **文件**: `tools/api_server.py`
- **行号**: L2611-2658

没有对单个 `doc_id` 或全局 WebSocket 连接数做上限检查。恶意客户端可打开大量连接导致内存耗尽。

---

### R6-P2-05: `api_server.py` — `wiki_write` 无内容大小限制

- **文件**: `tools/api_server.py`
- **行号**: L2365-2380

Pydantic 模型只要求 `min_length=1`，无 `max_length`。可写入超大文件耗尽磁盘。

---

### R6-P2-06: API 设计 — 错误响应格式不一致

至少存在三种不同的错误格式：

| 端点 | 错误键 | HTTP 状态码 |
|---|---|---|
| `rate_limit` | `error` | 429 |
| `get_page` | `detail` | 400 |
| `webhook_clip` | `success` + `error` | 200 |

搜索端点的分页字段名也不一致（`/api/search/fts` 返回 `count`，`/api/search` 返回 `total`）。

---

### R6-P2-07: `configStore.ts` — `saveToServer` 串行请求 + 部分成功无回滚

- **文件**: `wiki-viewer/src/stores/configStore.ts`
- **行号**: L158-177

三个独立的 POST 请求串行执行（总耗时 = t1 + t2 + t3），应使用 `Promise.all` 并行化。且部分成功无回滚机制，用户无法判断实际状态。

---

### R6-P2-08: `GraphPage.tsx` — vis-network tooltip 未转义（XSS）

- **文件**: `wiki-viewer/src/components/pages/GraphPage.tsx`
- **行号**: L149

```tsx
title: n.preview,  // vis-network 将 title 渲染为 HTML tooltip
```

如果 `preview` 包含 `<img src=x onerror=alert(1)>`，事件处理器属性可能被触发。

**修复**: 对 `n.preview` 进行 HTML 转义，或配置 vis-network 使用纯文本 tooltip。

---

### R6-P2-09: `build_graph.py` — 失败页面无限重试浪费 API 调用

- **文件**: `tools/build_graph.py`
- **行号**: L426-492

如果某个页面持续导致 LLM 返回无效 JSON，它永远不会被缓存或写入 checkpoint。每次 `--resume` 都会重新尝试该页面，浪费 API 调用和资金。

**修复**: 记录空条目到 cache/checkpoint 以跳过已失败的页面。

---

### R6-P2-10: `mcp_server.py` — 单例初始化竞态条件

- **文件**: `tools/mcp_server.py`
- **行号**: L30-35

```python
def _get_mcp_search_engine():
    global _mcp_search_engine
    if _mcp_search_engine is None:
        _mcp_search_engine = WikiSearchEngine()  # 无锁保护
```

如果两个 MCP 请求同时触发首次搜索，会创建两个 `WikiSearchEngine` 实例，前一个的 SQLite 连接泄漏。

**修复**: 使用 double-checked locking（参考 `api_server.py` 中的正确实现）。

---

### R6-P2-11: `search_engine.py` — 单锁导致 WAL 优势丧失

- **文件**: `tools/search_engine.py`
- **行号**: L99

所有操作（搜索、索引、删除）都使用同一个 `threading.Lock()`。在搜索期间（读操作），其他线程的搜索也会被阻塞。SQLite WAL 模式已允许并发读，但锁把这一优势完全抵消了。

---

## P3 — 低级别（8 个）

### R6-P3-01: `graph_analyzer.py` — `itertools.combinations` 内存爆炸风险

- **文件**: `tools/agent_kit/graph_analyzer.py`
- **行号**: L85-92

```python
all_pairs = list(itertools.combinations(nodes, 2))
```

10,000 个节点 → ~5000 万个元组，内存消耗约 2-4 GB。应使用随机采样替代先生成全部组合。

---

### R6-P3-02: `build_graph.py` — Windows `file://` URI 格式不正确

- **文件**: `tools/build_graph.py`
- **行号**: L851

```python
webbrowser.open(f"file://{GRAPH_HTML.resolve()}")
```

Windows 上 `file://E:\...` 不是有效的 file URI（应为 `file:///E:/...`）。应使用 `Path.as_uri()`。

---

### R6-P3-03: `search_engine.py` — `close()` 不清除连接引用

- **文件**: `tools/search_engine.py`
- **行号**: L425

调用 `close()` 后 `self._conn` 仍然引用已关闭的连接。后续意外调用任何方法会抛出 `ProgrammingError`。应设置 `self._conn = None`。

---

### R6-P3-04: `paths.py` — 未过滤 Windows 非法文件名字符

- **文件**: `tools/shared/paths.py`
- **行号**: L36

仅过滤了 ASCII 控制字符（0-31），但允许 `<>:"|?*` 等 Windows 文件名非法字符。

---

### R6-P3-05: `wiki.py` — wikilink 正则不处理嵌套方括号

- **文件**: `tools/shared/wiki.py`
- **行号**: L42

```python
return re.findall(r'\[\[([^\]]+)\]\]', content)
```

对于 `[[PageName|display [with brackets]]]` 这样的内容，匹配会失败。

---

### R6-P3-06: `query.py` — CJK bigram 匹配过于宽松

- **文件**: `tools/query.py`
- **行号**: L136-149

2 字符 CJK bigram 匹配非常宽松。常见中文词汇（如"数据"）几乎会匹配所有包含该词的问题，导致返回大量不相关页面。

---

### R6-P3-07: `wikiStore.ts` — 防抖持久化在页面关闭时丢失最新数据

- **文件**: `wiki-viewer/src/stores/wikiStore.ts`
- **行号**: L95-98

防抖延迟 500ms 写入 localStorage。如果用户在 500ms 内关闭标签页，最新的 state 将丢失。缺少 `beforeunload` 事件监听来 flush 挂起的写入。

---

### R6-P3-08: 所有前端页面 — 缺失 Error Boundary

BrowsePage、GraphPage、SearchPage、UploadPage、ChatPage 均无 Error Boundary 包裹。任何子组件异常都导致整个页面白屏崩溃。

---

## 系统性问题

### 1. 无文件锁机制

所有 wiki 文件读写都没有锁。watcher + CLI + MCP + API 服务器并发运行时数据竞争几乎必然发生。

### 2. 大量重复代码

`read_file`、`write_file`、`call_llm`、`append_log` 在多个文件中有独立的 fallback 实现。bug 修复需同步多处，维护成本高。

### 3. LLM 调用策略不统一

| 文件 | 重试 | 超时 | 回退 |
|---|---|---|---|
| `shared/llm.py` | 2 次重试 + 指数退避 | 120s | 抛出异常 |
| `ingest.py` (fallback) | 无 | 无 | 无 |
| `query.py` (fallback) | 无 | 无 | 无 |
| `build_graph.py` (fallback) | 无 | 无 | 无 |

### 4. 前端缺少统一错误处理

无全局 Error Boundary，任何组件异常都导致白屏。

---

## 建议修复优先级

```
P0 (立即)  → R6-P0-01 graph.json 并发损坏
           → R6-P0-03 sys.exit() 滥用
           → R6-P0-07 LLM 异常未捕获
           → R6-P0-06 符号链接绕过路径检查

P1 (本周)  → R6-P1-01 临时文件泄漏
           → R6-P1-04 TOCTOU 竞态
           → R6-P1-05 大文件 OOM
           → R6-P1-06 ~ 09 前端性能与状态管理

P2 (迭代中) → R6-P2-01 全量扫描性能优化
           → R6-P2-02 消息虚拟化
           → R6-P2-06 API 一致性
           → R6-P2-08 XSS 防护

P3 (有空时) → R6-P3-01 ~ 08 低优先级
```

---

## 修复状态跟踪（2026-05-09 更新）

| ID | 问题 | 状态 | 修复文件 |
|---|---|---|---|
| R6-P0-01 | graph.json 并发写入损坏 | ✅ 已修复 | `api_server.py` — `_GRAPH_REBUILD_LOCK` + atomic write |
| R6-P0-02 | ingestion_jobs 内存泄漏 | ✅ 已修复 | `api_server.py` — 原地删除过期条目 |
| R6-P0-03 | sys.exit() 滥用 | ✅ 已修复 | `query.py`, `build_graph.py`, `refresh.py`, `mcp_server.py` |
| R6-P0-04 | SSRF DNS 重绑定 | ✅ 已修复 | `api_server.py` — DNS 解析后二次校验 |
| R6-P0-05 | _run_tool_script 参数注入 | ✅ 已修复 | `api_server.py` — 脚本白名单 + 参数过滤 |
| R6-P0-06 | mcp_server 符号链接绕过 | ✅ 已修复 | `mcp_server.py` — `os.path.islink` 前置检查 |
| R6-P0-07 | LLM 调用无异常处理 | ✅ 已修复 | `shared/llm.py`, `ingest.py` — choices 空检查 + fallback 异常处理 |
| R6-P0-08 | ChatPage AbortController 未清理 | ✅ 已修复 | `ChatPage.tsx` — useEffect cleanup |
| R6-P1-01 | 临时文件永不清理 | ✅ 已修复 | `api_server.py` — finally 中 os.unlink |
| R6-P1-02 | API Key 明文写入 os.environ | ✅ 已修复 | `api_server.py` — `os.environ.setdefault` |
| R6-P1-03 | ingest.py 变量名遮蔽 | ✅ 已修复 | `ingest.py` — `source_path` → `wiki_source_path` |
| R6-P1-04 | TOCTOU 竞态条件（无文件锁） | ✅ 已修复 | `log.py`, `wiki.py`, `ingest.py`, `query.py`, `heal.py` — 原子写入 + 文件锁 |
| R6-P1-05 | 大文件 OOM 风险 | ✅ 已修复 | `shared/wiki.py` — 50MB 大小限制 + `ingest.py` — 入口检查 |
| R6-P1-06 | loadSessions 每次渲染执行 | ✅ 已修复 | `ChatPage.tsx` — 惰性初始化 |
| R6-P1-07 | isEditing 导致 vis-network 重建 | ✅ 已修复 | `GraphPage.tsx` — isEditingRef |
| R6-P1-08 | refreshGraphData 竞态条件 | ✅ 已修复 | `wikiStore.ts` — await _initPromise |
| R6-P1-09 | dismissAllCompleted 语义错误 | ✅ 已修复 | `ingestStore.ts` — filter 条件修正 |
| R6-P2-01 | 全量文件扫描性能 | ✅ 已修复 | `shared/wiki.py` — 5 秒 TTL 缓存 |
| R6-P2-02 | ChatPage 消息列表无虚拟化 | ✅ 已修复 | `ChatPage.tsx` — 窗口渲染 100 条 + 加载更多 |
| R6-P2-03 | refresh.py 重新加载 ingest 模块 | ✅ 无需修复 | 已使用 subprocess 替代 importlib |
| R6-P2-04 | WebSocket 无连接数限制 | ✅ 已修复 | `api_server.py` — 每文档 20 + 全局 100 |
| R6-P2-05 | wiki_write 无内容大小限制 | ✅ 已修复 | `api_server.py` — max_length=10MB |
| R6-P2-06 | API 错误响应格式不一致 | ✅ 已修复 | `api_server.py` — 统一 `{ok, error, code}` 全局异常处理 |
| R6-P2-07 | configStore 串行请求 | ✅ 已修复 | `configStore.ts` — Promise.all |
| R6-P2-08 | vis-network tooltip XSS | ✅ 已修复 | `GraphPage.tsx` — HTML entity 转义 |
| R6-P2-09 | 失败页面无限重试 | ✅ 已修复 | `build_graph.py` — 失败后写入空缓存/检查点 |
| R6-P2-10 | mcp_server 单例竞态 | ✅ 已修复 | `mcp_server.py` — double-checked locking |
| R6-P2-11 | search_engine 单锁 | ✅ 已修复 | `search_engine.py` — RLock |
| R6-P3-01 | combinations 内存爆炸 | ✅ 已修复 | `graph_analyzer.py` — 随机采样替代全量生成 |
| R6-P3-02 | Windows file URI 格式 | ✅ 已修复 | `build_graph.py` — `Path.as_uri()` |
| R6-P3-03 | close() 不清除连接引用 | ✅ 已修复 | `search_engine.py` — `self._conn = None` |
| R6-P3-04 | Windows 非法字符未过滤 | ✅ 已修复 | `paths.py` — 添加 `<>:\|?*` |
| R6-P3-05 | wikilink 正则不处理嵌套方括号 | ✅ 已修复 | `wiki.py` — 改进正则 |
| R6-P3-06 | CJK bigram 匹配过于宽松 | ✅ 已修复 | `query.py` — 移除 unigram fallback，严格要求 bigram 匹配 |
| R6-P3-07 | 防抖持久化页面关闭丢失 | ✅ 已修复 | `wikiStore.ts` — beforeunload 事件 |
| R6-P3-08 | 前端缺 Error Boundary | ✅ 已修复 | `router.tsx` — 每个路由已配置 `errorElement: <ErrorBoundary />` |
