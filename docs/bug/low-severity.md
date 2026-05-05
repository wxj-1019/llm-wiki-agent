# Low Severity Bugs

## Python 后端

### L1: `lint.py:227` — 使用了已弃用的 `IOError`

- **文件**: `tools/lint.py`
- **行号**: 227
- **严重程度**: **LOW**

**问题描述**:
```python
except (json.JSONDecodeError, IOError):
```
`IOError` 自Python 3.3起已是 `OSError` 的别名，但仍能工作，容易误导。

**修复建议**: 使用 `OSError`。

---

### L2: `health.py:287-291` — `str.replace(count=1)` 可能操作错误section

- **文件**: `tools/health.py`
- **行号**: 287-291
- **严重程度**: **LOW**

**问题描述**:
如果 `index.md` 中有重复的section header，`str.replace(section_header + "\n", ..., 1)` 只修第一个出现位置。后续条目可能被插入到错误的位置。

**修复建议**: 使用更精确的插入方法。

---

### L3: `heal.py:89-98` — `raise last_err` 在 `max_retries` 负数时异常

- **文件**: `tools/heal.py`
- **行号**: 89-98
- **严重程度**: **LOW**

**问题描述**:
如果 `max_retries` 为负，循环运行0次，`last_err` 保持为 `None`，`raise None` 抛出 `TypeError` 而非预期错误。

**修复建议**: 初始化 `last_err` 为默认异常，或添加 `max_retries >= 0` 断言。

---

### L4: `heal.py:229-231` — Windows文件名中的禁用字符未清理

- **文件**: `tools/heal.py`
- **行号**: 229-231
- **严重程度**: **LOW**

**问题描述**:
```python
safe_entity = Path(entity).name
```
不剔除Windows不支持的字符（`<`, `>`, `:`, `"`, `/`, `\`, `|`, `?`, `*`）。写文件时会在Windows上抛出 `OSError`。

**修复建议**:
```python
safe_chars = re.sub(r'[<>:"/\\|?*]', '_', entity)
```

---

### L5: `build_graph.py:537` — `generate_report` 没有 `HAS_NETWORKX` 守卫

- **文件**: `tools/build_graph.py`
- **行号**: 537
- **严重程度**: **LOW**

**问题描述**:
函数内部直接使用 `nx.Graph()` 没有检查networkx是否可用。当前通过调用处检查保证了安全，但函数本身在其他上下文中调用会崩溃。

**修复建议**: 在函数顶部添加 `if not HAS_NETWORKX: return ""`。

---

### L6: `multimodal_ingest.py:78` — 已耗尽的文件句柄导致静默失败

- **文件**: `tools/multimodal_ingest.py`
- **行号**: 78
- **严重程度**: **LOW**

**问题描述**:
`else` 分支调用 `.read()` 在任意对象上。如果文件已读取完毕，返回空字符串，base64编码产生空串，导致静默失败。

**修复建议**: 检查读取结果是否为空并提供信息性错误。

---

### L7: `skill_engine.py:203-204` — Jinja2不可用时模板包含未渲染的占位符

- **文件**: `tools/skill_engine.py`
- **行号**: 203-204
- **严重程度**: **LOW**

**问题描述**:
当Jinja2不可用时降级读取原始模板文件，`{{ variable }}` 占位符直接出现在prompt中。

**修复建议**: 至少替换已知占位符，或抛出明确错误。

---

### L8: `mcp_manager.py:312-318` — `call_tool()` 是未实现的桩

- **文件**: `tools/mcp_manager.py`
- **行号**: 312-318
- **严重程度**: **LOW**

**问题描述**:
`call_tool()` 总是返回错误。其他代码调用它时会产生难以诊断的失败。

**修复建议**: 实现该方法或显式抛出 `NotImplementedError`。

---

### L9: `agent_kit/graph_analyzer.py:84` — `total_pairs` 计算后未使用

- **文件**: `tools/agent_kit/graph_analyzer.py`
- **行号**: 84
- **严重程度**: **LOW**

**问题描述**: 死代码。移除以保持代码整洁。

---

### L10: `agent_kit/skill_generator.py:160-162` — 空白描述行产生YAML格式问题

- **文件**: `tools/agent_kit/skill_generator.py`
- **行号**: 160-162
- **严重程度**: **LOW**

**问题描述**: 已在M20中覆盖。

---

### L11: `api_server.py:1190` — `_load_llm_config` 副作用修改 `os.environ`

- **文件**: `tools/api_server.py`
- **行号**: 1190
- **严重程度**: **LOW**

**问题描述**:
`os.environ[key_env] = api_key` 修改全局进程环境。切换LLM配置时旧API key残留在环境变量中。

**修复建议**: 明确传递API key给 `completion()` kwargs而不是依赖环境变量。

---

## 前端

### L12: `MarkdownRenderer.tsx:67-74` — 每次主题变更都运行DOMPurify

- **文件**: `wiki-viewer/src/components/content/MarkdownRenderer.tsx`
- **行号**: 67-74
- **严重程度**: **LOW**

**问题描述**:
每次代码块的主题变更都会导入并运行DOMPurify。对于少量代码块可以接受，但许多代码块时可能造成卡顿。

**修复建议**: 考虑一次性净化或使用debounce。

---

### L13: `CommandPalette.tsx:112-125` — 为每个节点创建CommandItem

- **文件**: `wiki-viewer/src/components/layout/CommandPalette.tsx`
- **行号**: 112-125
- **严重程度**: **LOW**

**问题描述**:
为数百个节点都创建 `CommandItem` 对象，即使查询框未激活。当前对 <500 节点可接受。

**修复建议**: 仅在 `query.length > 0` 时惰性构建，或使用虚拟列表。

---

### L14: `configStore.ts:154-182` — 三个独立fetch串行调用

- **文件**: `wiki-viewer/src/stores/configStore.ts`
- **行号**: 154-182
- **严重程度**: **LOW**

**问题描述**:
三个独立的API调用串行执行而非并行，在慢速连接上保存时间翻三倍。

**修复建议**: 使用 `await Promise.all([...])`。

---

### L15: `Sidebar.tsx:160-169` — 移动端backdrop使用了误导性的ARIA角色

- **文件**: `wiki-viewer/src/components/layout/Sidebar.tsx`
- **行号**: 160-169
- **严重程度**: **LOW**

**问题描述**:
backdrop使用 `role="button"` 和 `tabIndex={0}`，但更合适的是 `role="presentation"` 并在侧边栏上添加正确的 `aria-label`。

**修复建议**: 将backdrop改为 `role="presentation"`，在侧边栏添加关闭按钮。

---

### L16: `GraphPage.tsx:360-379` — 布局保存请求没有超时控制

- **文件**: `wiki-viewer/src/components/pages/GraphPage.tsx`
- **行号**: 360-379
- **严重程度**: **LOW**

**问题描述**:
保存布局使用原始 `fetch` 调用，无超时或abort能力。用户离开页面后请求仍残留在浏览器中。

**修复建议**: 使用 `fetchWithTimeout` 和与组件生命周期绑定的 `AbortController`。

---

## 配置 / 基础设施

### L17: `pyproject.toml:5-7` — 占位符作者信息

- **文件**: `pyproject.toml`
- **行号**: 5-7
- **严重程度**: **LOW**

**问题描述**: `{name = "Your Name", email = "you@example.com"}` 仍为模板占位符。

---

### L18: `Dockerfile:27-33` — 不必要的文件被COPY到镜像中

- **文件**: `Dockerfile`
- **行号**: 27-33
- **严重程度**: **LOW**

**问题描述**:
`examples/`, `docs/`, `README.md`, `LICENSE` 等运行时不需要的文件被复制进镜像，增加镜像大小。

**修复建议**: 排除非运行时文件，或添加到 `.dockerignore`。

---

### L19: `.gitignore` — 缺少通配模式

- **文件**: `.gitignore`
- **严重程度**: **LOW**

**问题描述**:
`graph/.cache.json` 等文件显式列出，但将来新增的缓存文件不会被捕获。

**修复建议**: 添加通用模式 `graph/.*`。

---

### L20: `start_servers.py` — TOCTOU竞态条件

- **文件**: `start_servers.py`
- **严重程度**: **LOW**

**问题描述**:
检查端口是否可用的时间和实际启动服务器的时间之间存在竞态条件。

**修复建议**: 直接尝试绑定端口，失败后重试。
