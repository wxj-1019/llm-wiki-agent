# Medium Severity Bugs — Backend

## Python 工具脚本

### M1: `ingest.py:519-522` — `validate_ingest` 结果被计算但丢弃

- **文件**: `tools/ingest.py`
- **行号**: 519-522
- **严重程度**: **MEDIUM**

**问题描述**:
```python
validation = validate_ingest(created_pages)
```
调用返回包含 `broken_links` 和 `unindexed` 的字典，但返回值被完全忽视。ingest过程中产生的断链和未索引页面不会得到报告。

**修复建议**:
使用返回值，打印警告信息。

---

### M2: `ingest.py:351-355` — 临时转换文件永不清理

- **文件**: `tools/ingest.py`
- **行号**: 351-355
- **严重程度**: **MEDIUM**

**问题描述**:
当源目录只读时，`convert_to_md` 使用 `tempfile.mkdtemp()` 写入临时目录。这些临时文件和目录永远不会被删除。

**修复建议**:
使用 `tempfile.TemporaryDirectory` 作为上下文管理器，或在 finally 块中注册清理。

---

### M3: `query.py:224-227` — 查询提示词中缺少页面内容截断

- **文件**: `tools/query.py`
- **行号**: 224-227
- **严重程度**: **MEDIUM**

**问题描述**:
每个相关页面被完整读取并追加到 `pages_context`。虽然 `relevant[:15]` 限制了页面数量，但15个完整长度的wiki页面可能远超模型上下文窗口。

**修复建议**:
对每页内容施加字符限制: `p.read_text(encoding='utf-8')[:4000]`

---

### M4: `query.py:268-269` — YAML转义不完整

- **文件**: `tools/query.py`
- **行号**: 268-269
- **严重程度**: **MEDIUM**

**问题描述**:
```python
safe_title = question[:80].replace('"', '\\"')
```
只转义双引号。如果问题包含反斜杠+引号组合（如 `test\"`），会生成无效YAML。冒号在截断后出现在位置0也是未处理的。

**修复建议**:
使用 `yaml.dump()` 或更完整的转义函数。

---

### M5: `lint.py:409-417` — 只捕获 `LLMUnavailableError`，其他API错误导致工具崩溃

- **文件**: `tools/lint.py`
- **行号**: 409-417
- **严重程度**: **MEDIUM**

**问题描述**:
语义lint的 `try/except` 只捕获 `LLMUnavailableError`。网络错误、API key错误、速率限制等会导致整个lint运行崩溃，即使结构检查已经完成。

**修复建议**:
在 `LLMUnavailableError` 后添加更广泛的 `except Exception`。

---

### M6: `health.py:67-69` — `extract_frontmatter_title` 在文档任意位置匹配

- **文件**: `tools/health.py`
- **行号**: 67-69
- **严重程度**: **MEDIUM**

**问题描述**:
`re.search(r'^title:\s*["\']?(.+?)["\']?\s*$', content, re.MULTILINE)` 在整个文档体中搜索。如果页面的正文中包含以 `title:` 开头的行，它会被错误匹配为frontmatter标题。

**修复建议**:
将搜索限制在frontmatter块内（第一个和第二个 `---` 之间）。

---

### M7: `mcp_server.py:116` — `Path.relative_to() is not None` 检查永远为True

- **文件**: `tools/mcp_server.py`
- **行号**: 116
- **严重程度**: **MEDIUM**

**问题描述**:
`Path.relative_to()` 在Python 3.9+中从不返回 `None`——当路径不可相对化时它会抛出 `ValueError`。因此 `is not None` 检查永远为True。当前代码因为外层 try/except ValueError 而侥幸工作，但逻辑上存在误导。

**修复建议**:
移除 `is not None` 检查，仅依赖异常处理做路径验证。

---

### M8: `memory.py:45-46` — `_next_id()` 存在竞态条件

- **文件**: `tools/memory.py`
- **行号**: 45-46
- **严重程度**: **MEDIUM**

**问题描述**:
```python
existing = list(SESSIONS.glob(f"{prefix}-{today}-*.md"))
seq = len(existing) + 1
```
两个并发调用可能计算出相同的 `seq`。在单用户场景中不太可能发生，但MCP服务器处理并发请求时可能出现。

**修复建议**:
使用文件系统级锁（如 `fcntl` / `msvcrt`）保护ID生成。

---

### M9: `memory.py:217-224` — Frontmatter解析器在内容中的 `\n---\n` 处提前截断

- **文件**: `tools/memory.py`
- **行号**: 217-224
- **严重程度**: **MEDIUM**

**问题描述**:
`resume()` 使用 `re.match(r"^---\n(.*?)\n---\n", content, re.DOTALL)` 做frontmatter提取。如果frontmatter的YAML多行值中包含 `\n---\n`，解析器会提前截断，生成损坏的元数据。

**修复建议**:
使用与其他模块一致的frontmatter解析方法。

---

### M10: `search_engine.py:95` — 多个WikiSearchEngine实例创建多个SQLite连接

- **文件**: `tools/search_engine.py`
- **行号**: 95
- **严重程度**: **MEDIUM**

**问题描述**:
每个 `WikiSearchEngine()` 实例化都会调用 `_ensure_db()` 创建新的SQLite连接。虽然WAL模式支持并发读取，但 `rebuild_index()` 中的 `DELETE FROM wiki_pages` 会短暂持有写锁，可能导致其他实例出现 `database is locked` 错误。

**修复建议**:
考虑使用模块级单例连接或 `sqlite3.connect(..., uri=True)`。

---

### M11: `watcher.py:119-121` — 防抖定时器的竞态条件

- **文件**: `tools/watcher.py`
- **行号**: 119-121
- **严重程度**: **MEDIUM**

**问题描述**:
在 `cancel()` 和 `start()` 之间，旧定时器的回调可能已经在另一个线程中执行。回调完成后设置 `g_pending_timer = None`，而新的 `start()` 调用在一个空的pending集合上创建了新的定时器，导致丢失一次刷新周期。

**修复建议**:
添加代数计数器，在回调中检查是否过期。

---

### M12: `fetchers/arxiv_fetcher.py:45` — 使用明文HTTP访问arXiv API

- **文件**: `tools/fetchers/arxiv_fetcher.py`
- **行号**: 45
- **严重程度**: **MEDIUM**

**问题描述**:
```python
url = "http://export.arxiv.org/api/query?" + ...
```
明文HTTP允许中间人攻击。

**修复建议**:
使用 `https://export.arxiv.org/api/query?`。

---

### M13: `fetchers/arxiv_fetcher.py:130-131` — YAML frontmatter值未转义

- **文件**: `tools/fetchers/arxiv_fetcher.py`
- **行号**: 130-131
- **严重程度**: **MEDIUM**

**问题描述**:
```python
fm_lines = "\n".join(f'{k}: "{v}"' for k, v in fm.items())
```
虽然 `title` 被转义替换了双引号，但 `authors`, `categories`, `fetched_at`, `source_url` 等字段未转义，如果包含双引号会产生无效YAML。

**修复建议**:
对所有值应用转义，或使用 `yaml.dump()` 序列化frontmatter。

---

### M14: `agent_kit/diagram_generator.py:42,78` — Mermaid语法中的标题注入缺少转义

- **文件**: `tools/agent_kit/diagram_generator.py`
- **行号**: 42, 78
- **严重程度**: **MEDIUM**

**问题描述**:
```python
buf.write(f'    {node_id}["{title}"]\n')
```
如果页面标题包含 `"` 字符（或其他双引号变体如 `"`），Mermaid语法会损坏。

**修复建议**:
对Mermaid节点标签使用更全面的转义函数。

---

### M15: `agent_kit/mcp_generator.py:19` — `_escape_py_string` 转义不完整

- **文件**: `tools/agent_kit/mcp_generator.py`
- **行号**: 19
- **严重程度**: **MEDIUM**

**问题描述**:
```python
return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
```
未转义 `\r`、`\f`、`\v` 或 NUL 字符。如果wiki页面包含 `\r\n` 换行或NUL字节，生成的Python源码将包含原始控制字符。

**修复建议**:
使用 `repr()` 做转义，然后去除首尾引号。

---

### M16: `agent_kit/mcp_generator.py:284-290` — 假设所有页面路径以 `wiki/` 开头

- **文件**: `tools/agent_kit/mcp_generator.py`
- **行号**: 284-290
- **严重程度**: **MEDIUM**

**问题描述**:
```python
wiki_rel_path = page["path"].removeprefix("wiki/")
```
如果 `page["path"]` 不以 `wiki/` 开头，`removeprefix` 静默返回完整路径，导致 `read_wiki_page` 收到无效参数。

**修复建议**:
在使用前验证或规范化路径前缀。

---

### M17: `shared/log.py:46-48` — 日志写入在Windows上不是原子操作

- **文件**: `tools/shared/log.py`
- **行号**: 46-48
- **严重程度**: **MEDIUM**

**问题描述**:
先写临时文件再重命名的模式在Windows上不是真正原子的。如果两个进程同时调用 `append_log`，可能导致一条日志丢失。

**修复建议**:
使用排他锁保护日志写入。

---

### M18: `batch_compiler.py` / `archive_stale.py` — 重复的frontmatter解析逻辑

- **文件**: `tools/batch_compiler.py`, `tools/archive_stale.py`
- **严重程度**: **MEDIUM**

**问题描述**:
frontmatter解析逻辑在多个文件中重复实现，潜在存在边缘情况处理不一致的问题。

**修复建议**:
统一使用 `tools/shared/wiki.py` 中的frontmatter解析函数。

---

### M19: `export_agent_kit.py` — `--skip-health-checks` 标志绕过了关键错误检查

- **文件**: `tools/export_agent_kit.py`
- **严重程度**: **MEDIUM**

**问题描述**:
跳过健康检查可能在wiki处于损坏状态时仍然导出agent kit，产生不可用的输出。

**修复建议**:
至少保留关键的健康检查（如断链检测），仅跳过非关键的检查。

---

### M20: `agent_kit/skill_generator.py:160-162` — 空白描述行产生尾部空格的YAML行

- **文件**: `tools/agent_kit/skill_generator.py`
- **行号**: 160-162
- **严重程度**: **MEDIUM**

**问题描述**:
```python
for desc_line in description.split("\n"):
    lines.append(f"  {desc_line}")
```
如果 `description` 包含空行，生成的YAML会有仅含两个空格的空行，在某些YAML解析器中可能违反多行格式规则。

**修复建议**:
跳过空行或使用正确的YAML dump。
