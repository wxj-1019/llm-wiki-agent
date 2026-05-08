# 第三轮深度审查报告

> 审查日期: 2026-05-08 | 审查模型: deepseek-v4-pro | 审查范围: 完整项目 (Python工具链 + 前端 + 自动化管道)

---

## 审查概要

| 严重程度 | 数量 | 说明 |
|----------|------|------|
| **🔴 致命** | 5 | 会导致运行时崩溃、数据丢失或功能完全不可用 |
| **🟠 严重** | 7 | 会导致逻辑错误、安全漏洞或性能严重退化 |
| **🟡 中等** | 18 | 逻辑缺陷、设计不一致、可维护性问题 |
| **🟢 轻微** | 8 | 代码风格、优化建议、文档缺失 |
| **总计** | **38** | |

---

## 第一/二轮历史问题复核

已验证第一/二轮报告的 Critical/High 问题修复状态:

| 历史ID | 描述 | 状态 |
|--------|------|------|
| C1 | `build_graph.py` `existing_edge_summary` 未定义 | ✅ 已修复 (line 369-373) |
| C2 | `scheduler.py` `cmd.split()` Windows路径空格崩溃 | ✅ 已修复 (改用list) |
| C3 | `wikiStore.ts` `_persistTimer` 未声明 | ✅ 已修复 (line 105) |
| H1-H14 | 各种HIGH问题 | ✅ 已修复 |
| BE-038 | `lint.py` `find_missing_entities` 计数逻辑 | ⚠️ 仍需复查 |

---

# 🔴 致命问题 (5)

### B1. `tools/api_server.py:763` — 变量名错误导致 `/api/ingest` 端点完全不可用

```python
@app.post("/api/ingest")
async def api_ingest(payload: IngestPayload):
    path_str = path  # ← 'path' 未定义！应为 payload.path
    if not path_str:
        raise HTTPException(status_code=400, detail="path is required")
```

**根因**: 变量 `path` 在函数作用域内不存在。这是笔误——应该是 `payload.path`。

**影响**: 所有通过 API 调用的 ingest 操作（前端上传后ingest、webhook、clip、crawler pipe）全部抛出 `NameError`，返回500。

**修复**:
```python
path_str = payload.path
```

---

### B2. `tools/ingest.py:572` — `normalize_wikilinks` 导入无异常保护

```python
# ingest() 函数第571-572行，无 try/except:
from tools.shared.wiki import normalize_wikilinks

canonical_map = {}
for p in WIKI_DIR.rglob("*.md"):
    ...
```

**根因**: 其他所有 `tools/shared/*` 导入都使用 `try/except ImportError` + inline fallback 模式，唯独此处没有。如果 `tools/shared/wiki.py` 因任何原因（如 `yaml` 缺失）导入失败，整个 ingest 流程在文件已写入但验证阶段崩溃。

**影响**: 文件已写入磁盘、index 已更新、log 已添加，但 wikilink 规范化和验证阶段崩溃，留下不一致状态。

**修复**: 添加 try/except 保护，或在文件顶部导入。

---

### B3. `wiki-viewer/src/stores/wikiStore.ts:121-155` — `setInterval` 轮询叠加泄漏

```typescript
function _schedulePoll() {
  if (_pollInterval) clearInterval(_pollInterval);
  _pollInterval = setInterval(async () => {
    // ...
    _schedulePoll();  // ← 在回调中创建新的 interval，但旧 interval 仍在运行
    // ...
  }, _currentPollInterval);
}
```

**根因**: 函数内部调用 `_schedulePoll()` 创建新的 `setInterval`，但回调仍在当前 `setInterval` 的闭包中运行。新 interval 覆盖了 `_pollInterval` 引用，导致旧 interval 无法被清除。持续运行几个周期后，会有多个 interval 并发执行。

**影响**: 随着时间推移，poll 频率越来越高，对后端施加越来越大的压力，最终触发 rate limiter 或被浏览器节流。

**修复**: 使用 `setTimeout` 递归代替 `setInterval`：
```typescript
function _schedulePoll() {
  if (_pollTimer) clearTimeout(_pollTimer);
  _pollTimer = setTimeout(async () => {
    // ... same logic ...
    _schedulePoll(); // 安全的递归调用
  }, _currentPollInterval);
}
```

---

### B4. `tools/search_engine.py:226-233` — 语义搜索每次全量加载 embedding 到内存

```python
all_embeddings: dict[str, list[float]] = {}
with self._lock:
    cursor = self._conn.execute("SELECT path, embedding FROM wiki_embeddings")
    for row in cursor.fetchall():
        all_embeddings[path] = json.loads(emb_json)  # 全量反序列化

# 然后对所有 embedding 逐一计算 cosine similarity
for path, emb in all_embeddings.items():
    sim = self._cosine_similarity(query_emb, emb)
    vector_scores[path] = sim
```

**根因**: 没有使用 ANN（近似最近邻）索引，每次搜索 O(n) 遍历所有页面。且把所有 embedding 从 SQLite 文本字段反序列化到 Python 内存中。

**影响**: 
- 1000页 × 768维 × (JSON字符串开销 + float开销) ≈ 30-50MB 额外内存
- 每次语义搜索耗时随页面数线性增长
- 结合 `_cosine_similarity` 的纯 Python 循环，1000页约需 50-200ms（可接受但有上限风险）

**修复**: 引入本地向量索引（如 `faiss`、`hnswlib`、`chromadb`），或者限制加载范围到 FTS 结果的候选集。

---

### B5. `tools/fetchers/web_fetcher.py:619` — BFS 爬虫对同一 URL 重复 fetch

```python
while queue and source_pages < max_pages_per_source:
    url, name, tags, depth = queue.pop(0)
    s, sk, f = _process_one(url, name, tags, depth, base_domain)
    # _process_one 已经调用了 _fetch_html(url, ...)
    # ...
    if s > 0 and depth < max_depth:
        html, _ = _fetch_html(url, timeout, user_agent)  # ← 又 fetch 一次！
        if html:
            links = _extract_links(html, url)
```

**根因**: `_process_one` 内部已 fetch HTML 并提取内容，但主循环在成功后又调用 `_fetch_html` 再下载同一页面来提取链接。HTML 没有被缓存或传回。

**影响**: 每个成功抓取的页面都消费 2 次 HTTP 请求。对有 rate limit 的站点，这会浪费一半配额。

**修复**: `_process_one` 返回提取后的 HTML 内容，或把链接提取移到 `_process_one` 内部。

---

# 🟠 严重问题 (7)

### B6. `tools/api_server.py:555` — `application/octet-stream` 无条件绕过 Content-Type 验证

```python
if content_type == "application/octet-stream":
    pass  # ← 完全跳过验证
elif allowed and content_type and not any(content_type.startswith(a) for a in allowed):
    raise HTTPException(...)
```

**根因**: 浏览器对于无法识别的文件类型默认发送 `application/octet-stream`。攻击者可以上传恶意文件并依赖浏览器默认行为绕过 Content-Type 验证。

**影响**: 虽然文件扩展名仍有白名单检查，但对于 `.md` + `application/octet-stream` 组合完全放行。如果后续处理链（如 markitdown）有漏洞，可能被利用。

**修复**: 对 `octet-stream` 不跳过验证，而是降级为仅扩展名检查并记录警告日志。

---

### B7. `tools/api_server.py:601` — markitdown 转换失败时日志信息完全误导

```python
try:
    converted_path = await asyncio.to_thread(_do_convert)
    converted = converted_path.relative_to(REPO).as_posix()
except Exception as e:
    logger.warning("Config back-compat cleanup failed: %s", e)  # ← 错！
    pass  # ← 静默吞错
```

**根因**: 这段代码是从另一处复制粘贴过来的（见 `save_llm_config` 第1888行），日志消息未修改。

**影响**: 文件转换失败被静默吞掉，且日志消息指向完全无关的功能（config back-compat cleanup）。排查时会被严重误导。

**修复**:
```python
except Exception as e:
    logger.warning("File conversion failed for %s: %s", safe_name, e)
```

---

### B8. `wiki-viewer/src/lib/search.ts:98` — FTS5 ranking 映射到 Fuse.js score 的数学错误

```typescript
ftsMatches.push({
    item: mapped.node,
    refIndex: mapped.index,
    score: Math.max(0, r.rank / 100),  // FTS5 rank → Fuse score
    // ...
} as FuseResult<GraphNode>);
```

**根因**: 后端 `search_engine.py:289` 已经将 score 取反: `"rank": -r["score"]`（为了按升序排列）。前端又将 rank 除以 100。这导致:
- 后端 rank 可能是负值（因为已经取反）
- 前端 `Math.max(0, ...)` 对负值截断为 0
- 所有 FTS 结果 score=0，丧失排序能力

**修复**: 需要在后端/前端之间建立统一的 score 语义约定。建议后端传递原始 BM25 rank（负值，越负越好），前端按 rank 升序排列。

---

### B9. `tools/ollama_client.py:39-50` — `batch_embed` 缺少 fallback 重试

```python
def batch_embed(texts: list[str], model: str = "nomic-embed-text") -> list[list[float] | None]:
    try:
        result = _post("/api/embed", {"model": model, "input": texts})
        embeddings = result.get("embeddings", [])
        if len(embeddings) != len(texts):
            return [None] * len(texts)  # ← 直接返回全 None
        return embeddings
    except Exception:
        return [None] * len(texts)  # ← 无重试
```

**根因**: `search_engine.py:359-361` 有逐个文本的 fallback 逻辑，但 `ollama_client.py` 本身没有。调用方需要自行实现 fallback，但并非所有调用方都这样做。

**影响**: Ollama batch embed API 对某些模型（如 `nomic-embed-text` 旧版本）可能失败，此时所有 embedding 为 None，导致语义搜索静默降级。

**修复**: 在 `batch_embed` 内部添加逐个 fallback。

---

### B10. `wiki-viewer/src/stores/wikiStore.ts:96-97` — `persistState` 未被订阅的字段变更触发

```typescript
useWikiStore.subscribe((state, prevState) => {
  if (
    state.theme !== prevState.theme ||
    state.sidebarCollapsed !== prevState.sidebarCollapsed ||
    state.recentPages !== prevState.recentPages ||
    state.readingProgress !== prevState.readingProgress ||
    state.favorites !== prevState.favorites
  ) {
    persistState(state);  // ← 仅在某些字段变化时触发
  }
});
```

**根因**: subscribe 中的手动 diff 会漏掉未来的字段。如果新增需要持久化的字段但忘记在这里添加，数据不会自动保存。

**影响**: 目前无直接影响，但属于脆弱的维护模式。

**修复**: 使用 Zustand 的 `persist` middleware 代替手动持久化。

---

### B11. `wiki-viewer/src/hooks/useIngestStream.ts:82` — 组件 cleanup 时全局清空所有 SSE 连接

```typescript
useEffect(() => {
    // ...
    return () => {
      for (const es of activeConnections.values()) {
        es.close();
      }
      activeConnections.clear();  // ← 全局清空！
    };
  }, []);
```

**根因**: `activeConnections` 是模块级 Map，被所有组件实例共享。当 `useIngestStreamManager` 的**任一**实例 unmount 时，cleanup 会关闭**所有**活跃的 SSE 连接。

**影响**: React Strict Mode（开发模式）下会 double-mount/unmount，导致所有 SSE 连接在初始化后被立即关闭。生产模式下如果有多个页面使用该 hook，页面切换时连接被错误关闭。

**修复**: 使用 ref 追踪当前实例的连接，cleanup 时只关闭自己的连接。

---

### B12. `tools/reflect.py:288` — `import json` 在函数体中段执行

```python
def run_reflection(last_n=1, suggest_skills=False, dry_run=False) -> dict:
    # ... 140行代码 ...
    json_match = re.search(r"\{.*\}", response, re.DOTALL)
    if not json_match:
        # ...
    import json  # ← 第288行，函数体中段导入
    try:
        reflection = json.loads(json_match.group())
```

**根因**: 文件顶部未导入 `json`，而是在 `run_reflection` 函数中间导入。

**影响**: 无运行时错误（模块缓存），但代码风格混乱，阅读者困惑。

**修复**: 移到文件顶部 `import json`。

---

# 🟡 中等问题 (18)

### B13. `tools/api_server.py:168-176` — 限流器 `_rate_limit_store` 非线程安全

```python
_rate_limit_store: dict[str, list[float]] = defaultdict(list)
# 在线程池worker模型下，多线程同时修改dict → 竞态条件
```

**根因**: FastAPI 默认使用线程池（`run_in_threadpool`），多个请求可能并发修改 `defaultdict`，导致计数不准确。

**修复**: 使用 `threading.Lock` 保护，或使用 `asyncio.Lock`（对 async 中间件）。

---

### B14. `tools/archive_stale.py:92` — 索引条目移除使用子串匹配

```python
def _remove_from_index(index_text: str, rel_path: str) -> str:
    for line in lines:
        if rel_path in line and line.strip().startswith("-"):  # ← 子串匹配
            continue
```

**根因**: 如果 `rel_path = "sources/a.md"`，会误匹配 `sources/aa.md`、`sources/ba.md` 等。

**影响**: 归档一个页面可能同时在索引中误删其他条目。

**修复**: 使用正则精确匹配 markdown 链接部分: `](sources/a.md)`。

---

### B15. `tools/pdf2md.py:115-117` — marker 生成多文件时取第一个

```python
md_files = list(tmp_dir.rglob("*.md"))
if not md_files:
    print("Error: marker produced no markdown output.")
    sys.exit(1)
md_files[0].rename(output)  # ← 总是第一个，不一定是正确的主文件
```

**根因**: marker 可能产生多个 `.md` 文件（主文 + 附录/参考文献），`md_files[0]` 按 glob 顺序取第一个，不确定。

**修复**: 按文件大小排序取最大的，或查找与 PDF 同名的文件。

---

### B16. `tools/api_server.py:183-188` — 安全响应头不完整

```python
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "frame-ancestors 'none'"
    return response
```

**缺失的安全头**:
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security`
- `Referrer-Policy`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`

**修复**: 添加缺失的安全头。

---

### B17. `tools/scheduler.py:66-69` — compile 失败后仍执行 ingest

```python
def compile_and_ingest() -> None:
    _run(
        [PYTHON, "tools/batch_compiler.py"],
        [PYTHON, "tools/batch_ingest.py"],  # ← 不管 compiler 是否成功都执行
    )
```

**根因**: `_run` 函数顺序执行命令，但不会在第一个失败时停止。

**影响**: 如果 compiler 崩溃，ingest 可能处理旧数据或空batch。

**修复**: 检查 `_run` 返回值，或拆分为两个独立的任务。

---

### B18. `tools/shared/llm.py` 和多个 inline fallback — `call_llm` 签名不一致

| 文件 | `model_env` | `default_model` | `max_tokens` | `timeout` | `system` |
|------|------------|-----------------|-------------|-----------|----------|
| `shared/llm.py` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `ingest.py` (inline) | ❌ 硬编码 | ✅ | ❌ 硬编码 | ❌ | ❌ |
| `heal.py` (inline) | ✅ | ✅ | ✅ | ✅ | ❌ |
| `reflect.py` (inline) | ❌ 无此参数 | ❌ | ✅ | ❌ | ✅ |

**根因**: 每个工具文件有一份独立的 `call_llm` fallback 实现，参数列表各不相同。

**修复**: 统一删除所有 inline fallback，只使用 `shared/llm.py`。修正 `shared/llm.py` 支持 `system` 参数。

---

### B19. `tools/api_server.py:134-140` — 硬编码模型名散落多处

CLAUDE.md 声明默认模型为 `anthropic/claude-3-5-sonnet-latest`，该字符串在以下至少 7 个位置重复:
- `api_server.py:138-139`
- `api_server.py:408`
- `api_server.py:1450`
- `api_server.py:1486`
- `api_server.py:1580`
- `api_server.py:1765`
- `api_server.py:1860`

**影响**: 模型升级时需逐一修改，易遗漏。

**修复**: 定义模块级常量 `DEFAULT_MODEL = "anthropic/claude-3-5-sonnet-latest"`。

---

### B20. `tools/ingest.py:86-93` — `_file_hash` 失败时返回空字符串

```python
def _file_hash(path: Path) -> str:
    h = hashlib.sha256()
    try:
        h.update(path.read_bytes())
    except OSError:
        return ""  # ← 空字符串
    return h.hexdigest()
```

**根因**: 两个不同的、不可读的文件都会产生空哈希，可能被误认为相同。

**修复**: 返回 `None` 并在调用处处理。

---

### B21. `tools/health.py:250` — `_parse_log_entries` 仅匹配 `ingest` 操作

```python
for m in re.finditer(r'^## \[\d{4}-\d{2}-\d{2}\] ingest \| (.+)$', log_content, re.MULTILINE):
```

**根因**: 硬编码 `ingest`，忽略了 `query`、`lint`、`health`、`graph` 等操作类型。

**影响**: 目前仅用于 log coverage 检查（只检查 source page），所以影响有限。但如果未来扩展用途会遗漏数据。

---

### B22. `tools/query.py:231-242` — LLM 选择的路径可能被错误解析

```python
for p in paths:
    cand = (WIKI_DIR / p).resolve()
    try:
        cand.relative_to(WIKI_DIR.resolve())
    except ValueError:
        continue
```

**根因**: 路径穿越验证在 `.resolve()` 之后，`.resolve()` 本身会处理符号链接。虽然相对路径验证正确，但 LLM 可能返回如 `../../etc/passwd` 的路径，`resolve()` 会解析到实际路径，`relative_to` 会拒绝。这是安全的，但会在日志中产生无意义的 warning。

---

### B23. `tools/batch_compiler.py:84` — datetime 解析缺少 Python 版本兼容说明

```python
try:
    dt = datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
except Exception:
    dt = datetime.now(timezone.utc)
```

**根因**: Python 3.10 不支持 `fromisoformat` 解析 `Z` 后缀，`replace("Z", "+00:00")` 是正确的兼容处理，但代码中没有注释说明。

**影响**: 无运行时问题，但缺乏文档。

---

### B24. `tools/fetchers/github_fetcher.py:196-201` — trending 统计计数语义不准确

```python
for lang in languages:
    # ...
    for repo in items:
        info_saved = fetch_repo_info(full_name, token)
        if info_saved:
            saved.extend(info_saved)
    print(f"    → {len(items)} repos found, {len(saved)} new file(s) so far")
    # ← len(saved) 是累积所有语言的，而不是当前语言的
```

**根因**: `saved` 列表在语言循环开始前初始化，累计计数在输出时给人"本语言新增"的错觉。

**修复**: 分别追踪每个语言的新增。

---

### B25. `tools/health.py:147` — `_parse_index_links` 可能匹配非 markdown 链接的内容

```python
return set(re.findall(r'\[.*?\]\(([^)]+\.md)\)', index_content))
```

**根因**: 标题中包含 `)` 会截断匹配。例如 `[API (v2)](sources/api-v2.md)` → 匹配 `[API (v2`。

**影响**: 这些条目将被遗漏。

---

### B26. `tools/file_to_md.py:40` — `delete_source` 在写入后立即删除，无原子性保证

```python
output_path.write_text(result.text_content, encoding="utf-8")
if delete_source:
    file_path.unlink()  # ← 如果 write_text 成功但后续处理失败，源文件已丢失
```

**根因**: 删除在转换完成后立即执行，但如果转换质量有问题或磁盘空间不足导致后续操作失败，源文件无法恢复。

**修复**: 使用临时文件写入，然后原子 rename，再删除源文件。

---

### B27. `wiki-viewer/src/stores/ingestStore.ts:39` — job 恢复时将所有 running 标记为 failed

```typescript
function loadJobs(): IngestJob[] {
    // ...
    return parsed.map((j) =>
        j.status === 'running'
          ? { ...j, status: 'failed', logs: [...j.logs, '页面切换导致连接中断'] }
          : j
    );
}
```

**根因**: 消息 `'页面切换导致连接中断'` 硬编码为中文。国际环境（`en` locale）下用户会看到中文错误。

**修复**: 使用 i18n key 或在组件层显示时翻译。

---

### B28. `tools/api_server.py:848` — Windows 路径下 `-u` 标志冗余

```python
popen = subprocess.Popen(
    [PYTHON_EXE, "-u", str(REPO / "tools" / "ingest.py"), str(target)],
```

**根因**: `-u` 用于 stdout/stderr 无缓冲，但当 `stdout=subprocess.PIPE` 时 Python 默认就是无缓冲的。

**影响**: 无功能问题，但增加代码噪音。

---

### B29. `tools/fetchers/rss_fetcher.py:149` — `import yaml` 在 `run()` 函数体内

```python
def run(config_path: Path, max_per_feed: int) -> int:
    import yaml  # ← 每次调用都重新导入
```

**根因**: Python module cache 会处理重复导入，所以没有运行时开销。但代码风格不规范。

**修复**: 移到文件顶部。

---

### B30. `tools/fetchers/arxiv_fetcher.py:67` — `_extract_text` 签名与其他 fetcher 不一致

```python
# arxiv_fetcher.py:
def _extract_text(node, path: str) -> str:  # 无 ns 参数，使用模块级 NS

# rss_fetcher.py:
def _extract_text(node, path: str, ns=None) -> str:  # 支持可选的 ns
```

**根因**: arxiv 版本硬编码使用模块级 `NS`，不能传入自定义 namespace。

---

# 🟢 轻微问题 (8)

### B31. `tools/health.py:302` — `fix_log_coverage` 使用硬编码日期和固定标题

```python
entry = f"## [{today}] ingest | {title}\n\nAuto-added by health --fix."
```

**根因**: `title` 来自文件名或 frontmatter，但可能不是真正的 source title。

---

### B32. `tools/api_server.py:164` — `RATE_LIMIT_CLEANUP_INTERVAL = 300` 过长

5分钟才清理一次过期条目，在高并发期间可能积累大量 dead key。

---

### B33. `tools/web_fetcher.py:112` — robots.txt 内存缓存无过期策略

```python
_ROBOTS_CACHE: dict[str, urllib.robotparser.RobotFileParser] = {}
```

robots.txt 可以随时变化，但缓存永不过期。长期运行的 scheduler 进程不会反映网站 robots.txt 的更新。

---

### B34. `tools/pdf2md.py:71` — argparse epilog 设置为 `__doc__` 无效

```python
epilog=__doc__,
```

`__doc__` 是文件顶层 docstring 的**全部内容**，包含了完整的 Usage 和描述。epilog 应该只是简短的补充说明。

---

### B35. `wiki-viewer/src/lib/fetchWithTimeout.ts:20-37` — 外部 signal 与内部 timeout 的清理路径

```typescript
if (fetchInit.signal) {
    const externalSignal = fetchInit.signal;
    // ... 较复杂的清理逻辑
}
try {
    const res = await fetch(input, { ...fetchInit, signal: controller.signal });
    return res;
} finally {
    clearTimeout(id);  // ← 外部 signal 路径有 cleanUp()，简化路径没有
}
```

两条路径的清理逻辑不对称，但在当前行为下不影响功能。

---

### B36. `wiki-viewer/src/components/pages/UploadPage.tsx:137` — 图片 ingest 成功后调用 `refreshGraphData`

```typescript
if (result.success) {
    successCount++;
    showToast(...);
    refreshGraphData();  // ← 每张图片都刷新一次图
}
```

批量上传 5 张图片会触发 5 次图数据和搜索索引重建。

---

### B37. `tools/ingest.py:197` — `build_wiki_context` 截断时在前面加分节符

```python
content = content[:max_page_chars] + "\n... (truncated)"
parts.append(f"## {p.relative_to(REPO_ROOT)}\n{content}")
```

截断时 `\n... (truncated)` 前面缺少换行符，会粘在前面的文本上。

---

### B38. `wiki-viewer/vite.config.ts:11` — PWA Service Worker 范围过大

```typescript
VitePWA({
    registerType: 'autoUpdate',
    workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
```

Service Worker 拦截所有页面导航。如果有 `/api/` 以外的非前端路由，会被错误回退到 index.html。

---

# 优先修复路线图

## 第 1 批 — 立即修复 (1 天内)
| 优先级 | ID | 改动量 | 风险 |
|--------|-----|--------|------|
| 1 | B1 — `api_server.py:763` 变量名 | 1 行 | 零 |
| 2 | B5 — `web_fetcher.py:619` 重复fetch | ~5 行 | 低 |
| 3 | B6 — `api_server.py:555` octet-stream | ~3 行 | 低 |
| 4 | B7 — `api_server.py:601` 错误日志 | 1 行 | 零 |

## 第 2 批 — 本周修复
| 优先级 | ID | 改动量 | 风险 |
|--------|-----|--------|------|
| 5 | B2 — `ingest.py:572` 导入保护 | ~5 行 | 低 |
| 6 | B3 — `wikiStore.ts` 轮询泄漏 | ~15 行 | 中 |
| 7 | B8 — `search.ts` FTS score 映射 | ~10 行 | 中 |
| 8 | B14 — `archive_stale.py` 子串匹配 | ~5 行 | 低 |
| 9 | B11 — `useIngestStream.ts` 全局清理 | ~10 行 | 中 |

## 第 3 批 — 本月完成
| 优先级 | ID | 改动量 | 风险 |
|--------|-----|--------|------|
| 10 | B4 — `search_engine.py` 语义搜索 | ~200 行 | 高 |
| 11 | B9 — `ollama_client.py` fallback | ~20 行 | 低 |
| 12 | B10 — `wikiStore.ts` zustand persist | ~30 行 | 中 |
| 13 | B15 — `pdf2md.py` marker 多文件 | ~10 行 | 低 |
| 14 | B18 — 统一 `call_llm` 签名 | ~100 行 | 中 |
| 15 | B19 — 默认模型名常量化 | ~20 行 | 低 |

## 第 4 批 — 后续迭代
B16 (安全头), B13 (限流器线程安全), B17 (scheduler 错误传播), B20-B38 (代码质量)
