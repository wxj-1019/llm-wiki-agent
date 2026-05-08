# 第四轮深度审查报告

> 审查日期: 2026-05-08 | 审查范围: 全部 60+ 源文件深度阅读 | 继第三轮的补充发现

---

## 审查概要

本轮深度阅读了新文件: `mcp_manager.py`、`skill_engine.py`、`watcher.py`、`cli.py`、`ChatPage.tsx`、`GraphPage.tsx`、`SettingsPage.tsx`、`useChat.ts`、`configStore.ts`、`notificationStore.ts`、`frontmatter.ts`、`wikilink.ts`、`streamUtils.ts`、`constants.ts`、`logging_config.py`

| 严重程度 | 数量 | 说明 |
|----------|------|------|
| **🔴 致命** | 2 | 会导致运行时崩溃或安全漏洞 |
| **🟠 严重** | 5 | 逻辑缺陷、安全风险、设计缺陷 |
| **🟡 中等** | 13 | 逻辑问题、性能隐患、代码质量 |
| **🟢 轻微** | 5 | 代码风格、优化建议 |
| **总计** | **25** | |

---

# 🔴 致命问题 (2)

### C1. `tools/cli.py:102` — `search` 子命令使用了错误的参数名

```python
# cli.py:102
return _run_py("search_engine.py", "--query", args.query, "--limit", str(args.limit))
```

**根因**: `search_engine.py` 的 CLI 参数是 `--search`（不是 `--query`）：

```python
# search_engine.py:419
cli.add_argument("--search", type=str, default="", help="Search query")
```

**影响**: `wiki search "some query"` 命令完全不可用，会报 `unrecognized arguments: --query`。

**修复**: 改为 `"--search"`。

---

### C2. `tools/mcp_manager.py:165-166` — `git://` 和 `git@` URL 绕过安全验证

```python
def _install_url(self, name: str, server_dir: Path, kwargs: dict) -> dict:
    url = kwargs.get("url", "")
    if not url.startswith(("https://", "git://", "git@")):
        return {"error": "Only https://, git://, and git@ URLs are allowed"}
```

**根因**: 
1. `git://` 协议未加密，可被中间人攻击劫持
2. `git@` 不是合法的 URL scheme — Git SSH 格式是 `git@host:path`，不包含 `://`。这意味着 `url.startswith("git@")` 可以匹配 `git@evil.com/repo`，但 `git clone git@evil.com/repo` 不会正确工作(Git期望冒号分隔)

**影响**: 攻击者可以指定 `git@attacker.com:malware/repo` 格式的 URL（使用冒号分隔），它匹配 `startswith("git@")` 检查，然后传递给 `git clone` 执行。这是**远程代码执行风险**。

**修复**: 
1. 移除 `git://` 支持
2. 为 `git@` 格式添加正确的 SSH URL 格式验证: `re.match(r'^git@[\w.-]+:[\w./-]+$', url)`

---

# 🟠 严重问题 (5)

### C3. `tools/mcp_manager.py:231-241` — MCP 服务器继承完整环境变量

```python
def start(self, name: str) -> dict:
    env = os.environ.copy()  # ← 拷贝全部环境变量包括API密钥
    env["PYTHONPATH"] = str(REPO) + os.pathsep + env.get("PYTHONPATH", "")
    proc = subprocess.Popen(
        [sys.executable, str(server_file)],
        ...
        env=env,
    )
```

**根因**: `os.environ.copy()` 会把所有环境变量（包括 `ANTHROPIC_API_KEY`、`GEMINI_API_KEY`、`DEEPSEEK_API_KEY` 等）传递给 MCP 服务器子进程。如果安装了恶意 MCP 服务器，它可以读取并外泄这些密钥。

**影响**: API 密钥泄露风险。MCP 服务器代码可以是用户通过 URL 安装的第三方代码。

**修复**: 只传递必要的环境变量（白名单），或至少在安装第三方 MCP 服务器时给出警告。

---

### C4. `tools/skill_engine.py:168-201` — `_collect_context` 使用 O(n*k) 线性搜索匹配每个页面的每个关键词

```python
for p in self.wiki_dir.rglob("*.md"):
    ...
    content = p.read_text(encoding="utf-8")  # 读取全部内容
    content_lower = content.lower()
    score = 0
    for kw in keywords:
        if kw in rel_path:
            score += 10
        score += content_lower.count(kw)  # ← O(n) 每关键词每页面
```

**根因**: 
1. 对每个页面做 `rglob` 遍历、读取全文、逐关键词 `count()`
2. 已存在 `WikiSearchEngine` (SQLite FTS5) 提供了高效的全文搜索，但此处完全没用

**影响**: 1000 页 × 5 关键词 × 平均 3000 字符 ≈ 15M 字符扫描每次请求。而且每次都将匹配页面的**全内容**存入内存返回。

**修复**: 复用 `WikiSearchEngine.search()` 进行关键词匹配，仅在需要时按需加载页面内容。

---

### C5. `wiki-viewer/src/stores/wikiStore.ts:96-97` — `persistState` 手动字段diff遗漏新字段

```typescript
useWikiStore.subscribe((state, prevState) => {
  if (
    state.theme !== prevState.theme ||
    state.sidebarCollapsed !== prevState.sidebarCollapsed ||
    state.recentPages !== prevState.recentPages ||
    state.readingProgress !== prevState.readingProgress ||
    state.favorites !== prevState.favorites
  ) {
    persistState(state);
  }
});
```

**根因**: 手动白名单了需要持久化的字段。如果将来添加新字段（如 `language`、`fontSize`、`graphLayoutPreset`），必须记住同步更新这个 diff 列表，否则新配置在页面刷新后丢失。

**修复**: 使用 Zustand 的 `persist` middleware 替代手工持久化，自动追踪所有状态变更。

---

### C6. `tools/mcp_manager.py:242` — `log_buffers` 在 `_start_log_reader` 之前未初始化

```python
def start(self, name: str) -> dict:
    ...
    self.processes[name] = proc
    self.log_buffers[name] = collections.deque(maxlen=500)  # 初始化
    self._update_registry(name, "running", proc.pid)
    self._start_log_reader(name, proc)  # ← 传递了已初始化的log_buffers
    return {"pid": proc.pid, "status": "running"}

def _start_log_reader(self, name, proc):
    if name not in self.log_buffers:
        self.log_buffers[name] = collections.deque(maxlen=500)  # 双重检查
```

**根因**: `start()` 和 `_start_log_reader()` 都做了初始化，这两段代码在 `start()` 中调用的顺序是先初始化再传参，所以当前版本是安全的。但如果将来调用顺序改变或并发调用，可能出现不一致。

---

### C7. `wiki-viewer/src/lib/frontmatter.ts:23-28` — 数组解析器的引号跟踪使用 XOR 位运算技巧但可读性差

```typescript
function parseArray(raw: string): string[] {
  const inner = raw.slice(1, -1);
  let depth = 0;
  let current = '';
  for (const ch of inner) {
    if (ch === '"' || ch === "'") {
      depth ^= 1; // toggle quote depth
      current += ch;
    } else if (ch === ',' && depth === 0) {
      items.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
```

**根因**: `depth ^= 1` 在两个连续引号时无法正确工作。例如 `tags: ["a", "b"", "c"]` → 双引号 `""` 中的内容没有被转义处理。

**影响**: 如果 YAML frontmatter 中的数组元素包含转义引号 `"`，解析会出错。不过实际 wiki frontmatter 中极少出现。

---

# 🟡 中等问题 (13)

### C8. `tools/skill_engine.py:43` — `_register_builtins()` 覆盖用户安装的 skills

```python
def __init__(self, ...):
    self.registry = self._load_registry()
    if not self.registry.get("skills"):  # ← 仅当skills为空列表时调用
        self._register_builtins()
```

**根因**: 检测条件是 `not ...get("skills")`。如果 `installed.json` 文件存在但格式损坏 → `_load_registry` 返回默认 `{"version": 1, "skills": []}` → `_register_builtins()` 被调用 → 注册内置 skills → `_save_registry()` 覆盖损坏的文件。但如果用户手动删除了 `installed.json`，用户安装的 skills 目录仍在磁盘上但 registry 丢失，这些 skills 会被"遗忘"（不会重新出现）。

---

### C9. `tools/watcher.py:266-269` — daemon 模式导入在运行时失败

```python
if args.daemon:
    if os.name != "nt":
        import daemon          # ← 延迟导入，运行时才报错
        with daemon.DaemonContext():
            _watch_with_polling() if args.poll else _watch_with_watchdog()
```

**根因**: `daemon` 包（python-daemon）不是标准库依赖。包未安装时用户会看到 `ImportError: No module named 'daemon'`，而不是启动时的友好提示。

**修复**: 在文件顶部 try/except 导入，给出明确的安装提示。

---

### C10. `tools/mcp_manager.py:350` — 日志读取线程无异常恢复

```python
def _start_log_reader(self, name, proc):
    def reader():
        try:
            for line in proc.stdout:  # ← 同步阻塞迭代
                decoded = line.rstrip()[:2000]
                buf.append(decoded)
        except Exception:
            pass  # ← 静默退出，日志流中断
    t = threading.Thread(target=reader, daemon=True)
    t.start()
```

**根因**: 如果进程的标准输出流意外关闭或解码失败，reader 线程会静默退出。没有日志记录这个事件。

---

### C11. `tools/api_server.py:134-140` — 与前端的 SettingsPage 模型名同步问题

`api_server.py` 的 `LLMConfigPayload`:
```python
model: str = Field(default="anthropic/claude-3-5-sonnet-latest")
model_fast: str = Field(default="anthropic/claude-3-5-haiku-latest")
```

`SettingsPage.tsx` 的默认值:
```typescript
const [llmModel, setLlmModel] = useState('claude-3-5-sonnet-latest');
const [llmModelFast, setLlmModelFast] = useState('claude-3-5-haiku-latest');
```

**根因**: 后端默认值有 `anthropic/` 前缀，前端默认值没有。当前端首次加载 LLM config 时（`/api/llm-config`），后端返回的 `model` 字段可能带有 `anthropic/` 前缀（因为 `_resolve_model` 会添加）。如果后端 config 中设置的是 `claude-3-5-sonnet-latest`（无前缀），`_resolve_model` 会给它加上 `anthropic/` 前缀。前端显示的模型名会不一致。

---

### C12. `wiki-viewer/src/stores/notificationStore.ts:36-51` — 节流返回值类型不匹配

```typescript
addNotification: (message, type = 'info', progress) => {
    const now = Date.now();
    if (now - lastToastTime < TOAST_THROTTLE_MS && type !== 'progress') {
      set((state) => ({ ... }));
      return `${now}-${toastIdCounter}`;  // ← 提前返回 id
    }
    ...
    return id;
  },
```

**根因**: 接口声明返回 `void`，但实际返回 `string`（id）。TypeScript 严格模式下这不会报错（因为 `string` 可赋值给 `void`），但调用方无法使用返回值。

---

### C13. `wiki-viewer/src/stores/configStore.ts:236-259` — `parseGithubYaml` 简单正则解析不完整

```typescript
const langMatch = /languages:\s*\[(.*?)\]/.exec(text);
```

**根因**: 正则 `(.*?)` 贪婪匹配阻止，但如果 YAML 中 languages 写成多行格式 `[python,\n  javascript]`，换行符会导致 `.*?` 不匹配（默认不跨行）。

**影响**: 如果后端生成的 YAML 有换行，前端解析失败，回退到默认值 `['python']`。

---

### C14. `wiki-viewer/src/components/pages/ChatPage.tsx:200-211` — `useEffect` 的 `context` 自动发送有竞态条件

```typescript
useEffect(() => {
    const context = searchParams.get('context');
    if (!context || entries.length > 0 || loading || contextSentRef.current) return;
    contextSentRef.current = true;
    // ...
    doSend(query, [context]);
  }, []);  // ← 仅在 mount 时运行一次
```

**根因**: 
1. 如果 `entries` 或 `loading` 状态在 mount 时尚未准备好（异步），条件检查可能不正确
2. `doSend` 依赖 `entriesRef.current` 但 `entriesRef` 在 mount 时可能还是空数组
3. 依赖数组为 `[]`，但内部使用了 `entries`、`loading`、`doSend`，违反了 React hook 规则

**影响**: 
- React Strict Mode 下可能触发两次（已通过 `contextSentRef` 保护）
- 如果在页面完全初始化之前 URL context 被消费，可能导致错误的查询

---

### C15. `wiki-viewer/src/components/pages/GraphPage.tsx:498-505` — 删除节点只从 vis-network DataSet 中移除

```typescript
onClick={() => {
    const selected = net.getSelectedNodes();
    if (selected.length === 0) return;
    if (!window.confirm(t('graph.confirmDelete', { count: selected.length }))) return;
    const ds = nodesDataSetRef.current;
    if (ds) {
      selected.forEach((id: string) => ds.remove(id));  // ← 仅从UI中删除
    }
  }}
```

**根因**: 节点从 vis.js DataSet 中移除后前端不再显示，但底层的 `graph.json` 和 wiki 文件没有被修改。刷新页面后节点会重新出现。

**影响**: 用户以为删除了节点，但数据完好无损——这是个功能不完整的问题。

---

### C16. `wiki-viewer/src/components/pages/GraphPage.tsx:695-707` — 图密度使用了有向图公式但图是无向的

```typescript
const density = nodeCount > 1
    ? (edgeCount / (nodeCount * (nodeCount - 1))).toFixed(3)
    : '0.000';
```

**根因**: 这是**有向图**密度公式（最大边数 = n(n-1)）。如果图是**无向图**（如通过 `networkx.Graph()` 构建的 Louvain 社区），最大边数是 n(n-1)/2。当前公式低估了实际密度。

**影响**: 显示的密度值比实际值低一半。对于分析图结构健康度是一个误导性指标。

---

### C17. `wiki-viewer/src/lib/streamUtils.ts:57-62` — `_findOverlap` 最坏情况 O(n²)

```typescript
private _findOverlap(a: string, b: string): number {
    const maxOverlap = Math.min(a.length, b.length);
    for (let i = maxOverlap; i > 0; i--) {
      if (a.endsWith(b.slice(0, i))) return i;  // ← O(n) per iteration
    }
    return 0;
  }
```

**根因**: 对每个 `i` 值调用 `b.slice(0, i)` 和 `a.endsWith(...)`。`a` 的长度随流式响应增长，最终可能是数千字符。边缘情况下 `_findOverlap` 的调用本身可能达到 ~N²/2 的字符比较。

**影响**: 在长响应的边缘情况下（如a=5000, b=100, 每次查重），每次调用约 5K 字符比较，但总体频率低，实际影响有限。

---

### C18. `tools/shared/logging_config.py:28-37` — 每个 name 创建一次 handler 但通常只需要一次

```python
def get_logger(name, level=None):
    logger = logging.getLogger(f"wiki.{name}")
    if name not in _configured:
        _configured.add(name)
        if not logger.handlers:
            handler = logging.StreamHandler(sys.stderr)
            ...
```

**根因**: `_configured` 按 name 而不是按 logger 检查。每个不同的 name 都会创建一个新的 handler。如果多个工具使用不同的 name 调用（如 `"ingest"`, `"query"`），会有多个 handler 输出到 stderr。

**影响**: 相同日志消息可能出现重复（因为根 logger 和具名 logger 都输出）。已设置了 `logger.propagate = False`，所以重复输出不会发生。但多个具名 logger 各自有独立的 handler 实例，浪费资源。

---

### C19. `tools/skill_engine.py:125-136` — `match_trigger` 只做前缀匹配，不支持正则

```python
def match_trigger(self, user_input: str) -> list[dict]:
    for trigger in config.get("triggers", []):
        if user_input.lower().startswith(trigger.lower()):
            candidates.append(...)
```

**根因**: 只支持前缀匹配 `startswith`。如果用户输入 "帮我用wiki查一下AI最新论文"，而 trigger 是 "用wiki"，不会匹配。更灵活的匹配策略（如正则或子串匹配）没有被实现。

---

### C20. `wiki-viewer/src/components/pages/SettingsPage.tsx:81-88` — 导出 YAML 只包含 GitHub 配置

```typescript
const handleDownload = () => {
    const githubYaml = `trending:\n...`;
    const blob = new Blob([githubYaml], { type: 'text/yaml' });
    a.download = 'github_sources.yaml';
```

**根因**: 导出按钮硬编码输出 `github_sources.yaml`，但配置界面包含 RSS 和 arXiv 标签页。用户在不同标签页点击导出时，只能得到 GitHub 配置。且导出按钮的 label 是通用文字"Export"而非"导出 GitHub 配置"。

---

# 🟢 轻微问题 (5)

### C21. `tools/cli.py:119` — `build-graph` 命令不支持 `--report` 和 `--save`

`build_graph.py` 支持 `--report` 和 `--save` 标志，但 `cli.py` 没有暴露这些选项。用户需要通过 `build_graph.py` 直接调用才能使用报告功能。

---

### C22. `wiki-viewer/src/lib/constants.ts:18-26` — `TYPE_LABEL_KEY` 每次都创建新对象

```typescript
export const TYPE_LABEL_KEY = (type: string): string => {
  const map: Record<string, string> = { ... };  // ← 每次调用都创建
  return map[type] || type;
};
```

**根因**: `map` 在函数体内每次调用时重新创建。虽然是微小开销，但可以移到模块作用域。

---

### C23. `tools/watcher.py:104` — `g_file_hashes` 在长时间运行时无限增长

```python
g_file_hashes: dict[str, str] = {}
```

每次文件被 watch 到变化，hash 被添加/更新但永不过期。对于频繁创建/删除临时文件的场景，字典会持续增长。实际影响有限（key 是文件路径，通常不过千）。

---

### C24. `tools/mcp_manager.py:33` — `base_dir` 参数与默认值 `MCP_SERVERS_DIR` 不一致

```python
def __init__(self, base_dir: Path = MCP_SERVERS_DIR):
    self.base_dir = base_dir
```

`base_dir` 参数在构造函数中被接受，但 `self.registry_path` 通过 `base_dir / "installed.json"` 硬编码。如果传入不同的 `base_dir`，registry 路径会随之变化，这是正确的。但文档中没有说明。

---

### C25. `wiki-viewer/src/stores/notificationStore.ts:28` — `toastTimers` 是模块级 Map，SSR 不兼容

```typescript
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();
```

模块级可变状态在服务端渲染（SSR）场景下会在多个请求间共享，导致定时器泄漏和行为异常。不过当前项目是纯客户端渲染，无实际影响。

---

# 优先修复建议（增量）

## 立即修复 (本轮TOP3)
| ID | 问题 | 改动量 | 风险 |
|----|------|--------|------|
| C1 | `cli.py` search 参数名错误 | 1 行 | 零 |
| C2 | `mcp_manager.py` git:// 安全验证 | ~5 行 | 低 |
| C3 | `mcp_manager.py` 环境变量泄露 | ~10 行 | 中 |

## 本周修复
| ID | 问题 |
|----|------|
| C4 | `skill_engine.py` 复用FTS5搜索 |
| C5 | `wikiStore.ts` 使用 zustand persist |
| C7 | `frontmatter.ts` 数组解析引号处理 |
| C12 | `notificationStore.ts` 返回值类型 |
| C16 | `GraphPage.tsx` 图密度公式 |

## 后续迭代
C8-C11, C13-C15, C17-C25

---

# 四轮审查累计统计

| 严重程度 | 第一/二轮 | 第三轮 | 第四轮 | 总计 | 已修复 |
|----------|----------|--------|--------|------|--------|
| 致命 | 3 | 5 | 2 | **10** | 3 |
| 严重 | 14 | 7 | 5 | **26** | 14 |
| 中等 | 47 | 18 | 13 | **78** | ~30 |
| 轻微 | 16 | 8 | 5 | **29** | ~10 |
| **合计** | **80** | **38** | **25** | **143** | **~57** |

> 注: 第一/二轮数据来源于 `docs/bug/00-summary.md` 和 `docs/bug/critical-and-high.md` 的记录。历史 Critical/High 已全部修复。当前剩余未修复致命问题 3 个: B1(api_server:763), C1(cli:102), C2(mcp_manager:165)。
