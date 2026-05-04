# LLM Wiki Agent — 后端 Bug 报告

> 审查日期：2026-05-04 | 审查范围：api_server.py + tools/ + shared/ | 共 15 个文件

---

## P0 — 严重 Bug（安全漏洞）

### BE-001: api_server.py — /api/wiki-chat 的 context_pages 无路径遍历校验

- **文件**: `tools/api_server.py`
- **行号**: L807-818
- **描述**: `payload.context_pages` 中的路径直接拼接到 `WIKI / wiki_path`，未做路径遍历检查。攻击者可以传入 `../../../etc/passwd` 等路径读取服务器任意文件（仅限 `.md` 后缀）。
- **影响**: 可读取服务器上任意 `.md` 文件
- **建议修复**: 对每个 `wiki_path` 做路径遍历校验，确保 resolve 后在 `WIKI` 目录内

### BE-002: api_server.py — API key 明文存储在 config/llm.yaml

- **文件**: `tools/api_server.py`
- **行号**: L1108-1134
- **描述**: `save_llm_config` 将用户提交的 `api_key` 以明文写入 `config/llm.yaml`。如果该文件被提交到 git 仓库，API key 会泄露。
- **影响**: API 密钥泄露风险
- **建议修复**: 使用环境变量或加密存储 API key，至少在 `.gitignore` 中排除 `config/llm.yaml`

### BE-003: api_server.py — /api/config/{name} 写入任意 YAML

- **文件**: `tools/api_server.py`
- **行号**: L511-524
- **描述**: `save_config` 接口直接将原始 request body 写入 `.yaml` 文件，未做任何内容校验。文件路径仅做了简单的清洗，但 `config/` 目录不存在时会自动创建任意层级目录。
- **影响**: 配置注入、任意目录创建
- **建议修复**: 对写入内容做 schema 校验；限制只允许特定 config name（白名单）

---

## P1 — 高优先级 Bug

### BE-004: api_server.py — 速率限制器内存泄漏

- **文件**: `tools/api_server.py`
- **行号**: L110-125
- **描述**: `_rate_limit_store` 是一个全局 `defaultdict(list)`，每个新 IP 地址都会添加条目但从不清理空键。长时间运行后内存会持续增长。
- **建议修复**: 定期清理空的或过期的 key；使用 LRU cache 限制大小

### BE-005: api_server.py — /api/ingest 通过 subprocess 调用存在命令注入风险

- **文件**: `tools/api_server.py`
- **行号**: L458-491
- **描述**: `target` 路径被直接传入 `subprocess.run` 的参数列表。虽然路径已通过 `relative_to` 验证，但 Windows 上特殊字符可能引发问题。
- **建议修复**: 考虑使用 Python 函数调用而非 subprocess

### BE-006: mcp_manager.py — install 方法中 name 未做路径遍历检查

- **文件**: `tools/mcp_manager.py`
- **行号**: L74-118
- **描述**: `name` 参数直接用于创建目录 `self.base_dir / name`，如果 `name` 包含 `../` 等路径遍历字符，可能在 `base_dir` 之外创建目录或文件。
- **建议修复**: 对 `name` 做白名单校验（仅允许字母、数字、连字符）

### BE-007: mcp_manager.py — _install_url 中 git clone 未验证 URL 安全性

- **文件**: `tools/mcp_manager.py`
- **行号**: L140-156
- **描述**: `url` 参数直接传入 `git clone` 命令，可能被利用执行 `file://` 或其他协议的恶意操作。
- **建议修复**: 验证 URL scheme（只允许 `https://` 和 `git://`）

### BE-008: mcp_manager.py — _install_pip 任意包安装

- **文件**: `tools/mcp_manager.py`
- **行号**: L128-138
- **描述**: `package` 参数直接传入 `pip install`，允许安装任意 PyPI 包，这是一个严重的供应链攻击面。
- **建议修复**: 添加包名白名单或至少验证包名格式；在虚拟环境中安装

### BE-009: skill_engine.py — install 中 name 未做路径遍历检查

- **文件**: `tools/skill_engine.py`
- **行号**: L54-90
- **描述**: 与 MCP manager 相同的问题。
- **建议修复**: 对 `name` 做白名单校验

### BE-010: ingest.py — 不支持的格式返回 None 而非 dict

- **文件**: `tools/ingest.py`
- **行号**: L373-379
- **描述**: 当 `source.suffix.lower() not in CONVERTIBLE_EXTENSIONS` 时函数 `return` 但无返回值（返回 `None`），而调用方期望返回 dict。后续 `result["success"]` 会抛出 `TypeError`。
- **建议修复**: 返回 `{"success": False, "error": "Unsupported format"}`

---

## P2 — 中等优先级

### BE-011: api_server.py — 搜索 API 返回所有内容，无分页

- **行号**: L209-225
- **描述**: `/api/search` 会遍历所有 wiki 文件并将内容全部加载到内存。
- **建议修复**: 添加分页参数

### BE-012: api_server.py — upload_file 可能累积大内存

- **行号**: L351-405
- **描述**: 文件内容全部读入内存再写入磁盘，高并发下是内存风险。
- **建议修复**: 使用流式写入到临时文件

### BE-013: api_server.py — _load_llm_config 每次请求都读磁盘

- **行号**: L683-702
- **描述**: 每次调用 LLM 相关端点都会读磁盘文件并解析 YAML。
- **建议修复**: 添加带 TTL 的内存缓存

### BE-014: api_server.py — wiki_chat SSE 流错误时未发送 [DONE]

- **行号**: L864-865
- **描述**: 错误时没有发送 `[DONE]` 信号，客户端可能一直等待。
- **建议修复**: 在错误后也发送 `data: [DONE]\n\n`

### BE-015: api_server.py — /api/health 暴露服务器内部路径

- **行号**: L227-236
- **描述**: 返回 `wiki_dir` 的完整服务器路径，属于信息泄露。
- **建议修复**: 不返回绝对路径

### BE-016: mcp_manager.py — _start_log_reader 中 proc.stdout 可能返回 bytes

- **行号**: L305-316
- **描述**: `Popen` 未指定 `text=True`，Windows 上非 UTF-8 字符可能抛出异常。
- **建议修复**: 使用 `text=True, errors='replace'` 参数

### BE-017: mcp_manager.py — log_buffers 无上限增长

- **行号**: L32, L311-312
- **描述**: 虽然做了截断（超过 1000 条时保留最后 500 条），但每条日志可能很长。
- **建议修复**: 限制每条日志的长度，使用 `collections.deque(maxlen=500)`

### BE-018: mcp_manager.py — uninstall 中 shutil.rmtree 可能删除非预期目录

- **行号**: L182-190
- **描述**: 如果 `name` 包含路径遍历字符，`shutil.rmtree` 可能删除仓库外的目录。
- **建议修复**: 清洗 `name` 参数

### BE-019: mcp_manager.py — _register_builtins 覆盖已有注册表

- **行号**: L318-371
- **描述**: 直接用 `self.registry["servers"] = builtins` 覆盖，会丢失用户已安装的服务器信息。
- **建议修复**: 只在 registry 为空时调用，且合并而非覆盖

### BE-020: skill_engine.py — save_skill_file 中 replace("..", "") 不安全

- **行号**: L232-233
- **描述**: 简单的 `replace("..", "")` 可以被 `....//` 绕过。
- **建议修复**: 完全依赖后续的 `resolve().relative_to()` 检查

### BE-021: skill_engine.py — _collect_context 加载所有文件到内存

- **行号**: L162-190
- **描述**: 遍历所有 wiki 文件并读取全部内容到内存中做关键词匹配。
- **建议修复**: 添加文件大小限制，或只读取文件的前 N 行

### BE-022: skill_engine.py — Jinja2 模板渲染存在潜在 SSTI

- **行号**: L192-200
- **描述**: 如果 skill 的 `prompts/` 目录被篡改，可能注入恶意模板代码。
- **建议修复**: 使用 `jinja2.sandbox.SandboxedEnvironment`

### BE-023: shared/paths.py — safe_filename 未处理 Windows 保留文件名

- **行号**: L32-43
- **描述**: 没有处理 `CON`, `PRN`, `AUX`, `NUL` 等 Windows 保留文件名。
- **建议修复**: 添加 Windows 保留文件名检查

### BE-024: shared/llm.py — call_llm 无重试/超时机制

- **行号**: L37-67
- **描述**: 直接调用 `completion()` 无超时和重试机制。网络问题会导致脚本永久挂起。
- **建议修复**: 添加 `timeout` 参数和重试逻辑

### BE-025: shared/wiki.py — extract_frontmatter_title 正则不匹配多行值

- **行号**: L78-81
- **描述**: 无法匹配 YAML 中 `title: >` 或 `title: |` 折叠/字面量标量的情况。
- **建议修复**: 使用更健壮的 YAML 解析

### BE-026: shared/log.py — append_log 非原子写入，并发不安全

- **行号**: L24-40
- **描述**: 读取、修改、写入 log 文件不是原子操作。如果两个进程同时 ingest，可能丢失日志条目。
- **建议修复**: 使用文件锁或 `append` 模式写入

### BE-027: shared/log.py — header 拆分逻辑脆弱

- **行号**: L32-39
- **描述**: 用 `existing.split("\n---\n", 1)` 来分割，如果日志内容中包含 `---` 分隔线可能错误分割。
- **建议修复**: 使用更精确的分割策略

### BE-028: shared/graph_html.py — CDN 依赖无完整性校验

- **行号**: L44
- **描述**: `<script src="https://unpkg.com/vis-network/...">` 没有 `integrity` 属性（SRI）。
- **建议修复**: 添加 `integrity` 和 `crossorigin` 属性

### BE-029: shared/graph_html.py — JSON 嵌入的 XSS 防护不完整

- **行号**: L27-28
- **描述**: `.replace("</", "<\\/")` 只处理了 `</script>` 标签闭合。
- **建议修复**: 当前防护对于此场景足够，但可考虑使用 `json.dumps` 的 `ensure_ascii=True`

### BE-030: ingest.py — build_wiki_context 可能超过 LLM token 限制

- **行号**: L172-184
- **描述**: 读取 index、overview 和最近 5 个源页面的全部内容，如果页面很大 prompt 可能超过 token 限制。
- **建议修复**: 对每个页面的内容做截断（如限制 2000 字符）

### BE-031: ingest.py — validate_ingest 中路径未规范化

- **行号**: L277-278
- **描述**: `WIKI_DIR / p` 拼接路径时如果 `p` 包含 `..` 可能导致扫描范围外的文件。
- **建议修复**: 对 `p` 做路径清洗

### BE-032: ingest.py — parse_json_from_response 可能匹配错误的 JSON

- **行号**: L187-195
- **描述**: `re.search(r"\{[\s\S]*\}", text)` 使用贪婪匹配，可能匹配到错误的范围。
- **建议修复**: 使用非贪婪匹配或更精确的 JSON 提取

### BE-033: query.py — find_relevant_pages 中 href 存在路径遍历

- **行号**: L135-136
- **描述**: 从 index.md 中提取的 `href` 直接拼接到 `WIKI_DIR / href`。如果攻击者能控制 index.md 内容，可以读取任意文件。
- **建议修复**: 对 `href` 做路径遍历校验

### BE-034: build_graph.py — 节点数据包含全部 markdown 内容

- **行号**: L196-215
- **描述**: 每个节点的 `"markdown"` 字段包含完整页面内容，使得 `graph.json` 文件可能非常大。
- **建议修复**: 仅存储摘要或 preview

### BE-035: build_graph.py — 对每个页面都发送完整 node_list

- **行号**: L335
- **描述**: `node_list` 对每个页面都重新构建一次，浪费 token。
- **建议修复**: 预先构建 `node_list` 一次

### BE-036: build_graph.py — 双向去重逻辑丢失方向性

- **行号**: L436-471
- **描述**: A→B 和 B→A 会被合并为单一条边，丢失了方向性。
- **建议修复**: 分别保留两个方向的最佳边

### BE-037: health.py — check_index_sync 过滤条件语义不清

- **行号**: L179-181
- **描述**: `if REPO_ROOT in p.parents or p == REPO_ROOT` 条件实际上总是为 True。
- **建议修复**: 简化或添加注释说明

### BE-038: lint.py — find_missing_entities 计数逻辑错误

- **行号**: L172-182
- **描述**: 同一页面多次 wikilink 同一实体会被重复计数。
- **建议修复**: 先对每个页面去重 wikilink，再统计跨页面出现次数

---

## P3 — 低优先级

### BE-039: api_server.py — spa_fallback_handler 可能覆盖正常 API 错误

- **行号**: L138-147
- **建议修复**: 添加更多排除规则

### BE-040: shared/llm.py — yaml 不可用时静默失败

- **行号**: L12-29
- **建议修复**: 添加 `logger.warning` 提示

### BE-041: shared/wiki.py — all_wiki_pages 返回列表而非生成器

- **行号**: L49-51
- **建议修复**: 大量文件时可考虑返回生成器

### BE-042: health.py — fix_log_coverage 绕过 append_log

- **行号**: L298-327
- **建议修复**: 使用 `append_log()` 函数

### BE-043: lint.py — 语义 lint 只采样 20 个页面

- **行号**: L378
- **建议修复**: 按重要性采样或增加采样量

### BE-044: build_graph.py — sys.path.insert 可能影响其他模块导入

- **行号**: L38-39
- **建议修复**: 确保不与其他导入冲突

### BE-045: heal.py — call_llm fallback 签名与 shared 版本不一致

- **行号**: L65-87
- **描述**: fallback 版本缺少 `model_env` 和 `default_model` 参数。
- **建议修复**: 统一函数签名

### BE-046: heal.py — search_sources 对短实体名匹配过多

- **行号**: L118-127
- **描述**: entity 是一个很短的常见词（如 "AI"）会匹配大量页面。
- **建议修复**: 添加最小长度检查，或使用正则匹配 `[[entity]]`

### BE-047: query.py — 使用 input() 交互式输入

- **行号**: L257
- **描述**: 非交互式环境（如 CI/CD）中运行会挂起。
- **建议修复**: 检测是否在 TTY 中运行

### BE-048: ingest.py — 重复赋值 source = Path(source_path)

- **行号**: L364-365
- **建议修复**: 删除重复行
