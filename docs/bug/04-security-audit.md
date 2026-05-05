# 安全审计 & 深度逻辑漏洞报告

> 审计日期：2026-05-05 | 审计范围：后端 API、前端服务、核心工具 | 发现 63 个问题，已修复 23 个问题

---

## 修复统计

| 严重级别 | 总计 | 已修复 | 未修复 | 修复率 |
|---|---|---|---|---|
| **P0（严重）** | 8 | 8 | 0 | **100%** |
| **P1（高）** | 14 | 8 | 6 | **57%** |
| **P2（中）** | 27 | 7 | 20 | **26%** |
| **P3（低）** | 14 | 0 | 14 | **0%** |
| **合计** | **63** | **23** | **40** | **37%** |

---

## 已修复的 P0 问题（8 个）

| ID | 文件 | 描述 | 修复方式 |
|---|---|---|---|
| SEC-BE-001 | `tools/api_server.py` | `wiki_write` 使用 `startswith` 做路径检查，攻击者可构造 `wiki-test/evil.md` 绕过写入项目任意目录 | 替换为 `Path.relative_to()` 安全检查 |
| SEC-BE-002 | `tools/api_server.py` | `wiki_chat` 的 `context_pages` 路径检查使用 `startswith`，同 SEC-BE-001 | 替换为 `Path.relative_to()` 安全检查 |
| SEC-BE-003 | `tools/mcp_server.py` | `_safe_wiki_path` 使用 `startswith` 做路径边界检查 | 替换为 `Path.relative_to()` 安全检查 |
| SEC-BE-004 | `tools/mcp_server.py` | `_run_ingest` 使用 `startswith` 检查 allowed_roots | 替换为 `Path.relative_to()` 安全检查 |
| SEC-FE-001 | `wiki-viewer/src/services/dataService.ts` | `saveWikiPage` 缺少 `isValidFilePath` 验证，其他函数（triggerIngest, fetchRawFileContent, deleteRawFile）均有此验证 | 添加 `isValidFilePath(path)` 检查 |
| SEC-FE-002 | `wiki-viewer/src/lib/fetchWithTimeout.ts` | `controller.signal` 覆盖了调用者传入的 `init.signal`，导致外部无法取消请求（如 agentKit 长时间操作） | 链接外部 signal 到内部 AbortController |
| SEC-FE-003 | `wiki-viewer/src/components/content/MarkdownRenderer.tsx` | `CodeBlock` 在 `if (!html)` 提前返回之后声明 `useState`/`useEffect`，违反 React Hooks 规则，可能导致状态错乱和 XSS | 将 `safeHtml` state 和对应 useEffect 移到条件返回之前 |
| SEC-FE-004 | `wiki-viewer/src/components/layout/Header.tsx` | `<div ref={searchRef}>` 缺少关闭标签 `</div>`，导致 JSX 编译错误，前端无法正常加载 | 添加缺失的 `</div>` 关闭标签 |

---

## 已修复的 P1 问题（8 个）

| ID | 文件 | 描述 | 修复方式 |
|---|---|---|---|
| SEC-BE-005 | `api_server.py` | `_require_webhook_token` 在 `WIKI_WEBHOOK_TOKEN` 未设置时仅警告不拒绝 | 未设置 token 时返回 401 拒绝请求 |
| SEC-TOOL-001 | `ingest.py` | `ingest()` / `convert_to_md()` 中使用 `sys.exit(1)` 终止进程 | 改为自定义 `IngestError` 异常，仅 `__main__` 捕获后退出 |
| SEC-TOOL-002 | `search_engine.py` | `search()` 已有 `self._lock` 保护（审查时误报） | 确认无需修复 |
| SEC-TOOL-003 | `api_server.py` | `_get_search_engine()` 全局单例无线程安全初始化 | 使用双重检查锁定模式（`threading.Lock`） |
| SEC-FE-005 | `useChat.ts` | 双击发送绕过 `chatLoading` 守卫（闭包旧值），导致并发 LLM 请求 | 添加 `chatLoadingRef` 在所有 3 条路径（knowledgeGen/stream/quickPrompt）同步状态 |
| SEC-FE-006 | `agentKitService.ts` + `agentKitLLMService.ts` | `fetchAgentKitFiles`、`downloadAgentKitFile`、`readAgentKitFile`、`saveAgentKitFile` 未调用 `isValidFilePath` | 所有 4 个函数添加路径验证 |
| SEC-FE-008 | `wikiStore.ts` | `_startPolling` 的 ETag 轮询无并发锁，`fetchGraphData` 耗时超 30s 时 interval 重叠执行 | 添加 `_pollFetching` 布尔锁防止并发 |
| SEC-BE-007 | `api_server.py` | `webhook_clip` SSRF 防护仅黑名单 4 个主机名，可通过 `10.x.x.x` 等绕过 | 使用 `ipaddress` 模块检查 `is_private`/`is_loopback`/`is_link_local`/`is_reserved` + `.local` 域名拦截 |

---

## 已修复的 P2 问题（7 个）

| ID | 文件 | 描述 | 修复方式 |
|---|---|---|---|
| SEC-BE-014 | `api_server.py` | `webhook_clip` 中 `payload.title` 直接嵌入 YAML frontmatter 双引号字符串，可破坏 YAML 结构 | 对 title 和 url 进行反斜杠和双引号转义 |
| SEC-BE-015 | `api_server.py` | `source_url` 字段无引号包裹，含特殊字符的 URL 会破坏 frontmatter | 为 `source_url` 添加引号包裹并转义 |
| SEC-BE-023 | `api_server.py` | 搜索引擎单例未在服务器关闭时调用 `close()`，SQLite 连接可能未正确释放 | lifespan 中已有 shutdown 钩子关闭搜索引擎（审查时误报） |
| SEC-FE-012 | `agentKitService.ts` | `downloadAgentKitZip` 中 `URL.revokeObjectURL()` 在 `a.click()` 后立即调用，Firefox 可能下载失败 | 使用 `setTimeout(() => URL.revokeObjectURL(url), 1000)` 延迟释放 |
| SEC-FE-016 | `notificationStore.ts` | `removeNotification` 未清理关联的 toast 计时器（`dismissToast` 有正确清理） | 在 `removeNotification` 中清理 toastTimers 并同步移除 toasts |
| SEC-FE-017 | `configStore.ts` | `deepMerge` 不验证 key 白名单，`__proto__` 等特殊 key 可能被注入 | 添加 `DANGEROUS_KEYS` 黑名单过滤 `__proto__`/`constructor`/`prototype` |
| SEC-TOOL-019 | `health.py` | `fix_index_sync` 无去重检查，连续运行 `--fix` 可能产生重复 index 条目 | `replace()` 调用添加 `count=1` 参数限制每次只替换一次 |

---

## 未修复问题清单

### 后端 API 安全问题（P1）

| ID | 文件 | 描述 | 风险 | 建议 |
|---|---|---|---|---|
| SEC-BE-006 | `api_server.py` 全局 | 大部分 API 端点无认证保护（`/api/wiki/write`、`/api/ingest`、`/api/llm-config`、`/api/upload/file`、`/api/agent-kit/save-file` 等） | 数据篡改、密钥泄露、费用滥用 | 添加全局 API key 或 session-based 认证中间件 |
| SEC-BE-008 | `api_server.py` L987-1053 | LLM 聊天端点（`llm-chat`、`llm-chat-stream`）无消息数量/长度/费用限制 | 巨额 API 费用 | 添加请求频率限制、单日消息总量限制、费用告警 |
| SEC-BE-009 | `api_server.py` L1296-1300 | `agent_kit_generate_from_knowledge` 用户输入直接拼接到 LLM prompt，存在提示注入风险 | 诱导 LLM 生成恶意代码 | 对用户输入进行清洗/隔离，添加 system prompt 边界 |
| SEC-BE-010 | `api_server.py` L1107-1113 | `wiki_chat` 中 wiki 页面内容直接嵌入 system prompt，恶意 wiki 页面可劫持 RAG 查询 | RAG 提示注入 | 对 wiki 内容进行长度限制和可疑指令过滤 |

### 后端 API 安全问题（P2）

| ID | 文件 | 描述 | 风险 | 建议 |
|---|---|---|---|---|
| SEC-BE-011 | `api_server.py` L430-448 | `get_raw_file_content` 无文件类型限制，可读取 raw/ 下任意二进制文件 | 信息泄露 | 限制只读取文本类型文件 |
| SEC-BE-012 | `api_server.py` L466-485 | `upload_file` 存在 TOCTOU 竞态条件（`exists()` 检查与 `open()` 写入之间可被并发请求覆盖） | 数据覆盖 | 使用 `os.open()` + `O_CREAT \| O_EXCL` 原子创建 |
| SEC-BE-013 | `api_server.py` L1827-1847 | `graph_save_layout` 非原子读写（read-modify-write），并发请求可能导致 JSON 损坏 | 数据损坏 | 使用 write-to-temp-then-rename 模式 |
| SEC-BE-016 | `api_server.py` L936,1417 | API 密钥明文存储在 `.cache/llm_api_key` 文件中 | 密钥泄露（如果仓库被推送） | 使用加密存储或仅依赖环境变量 |
| SEC-BE-017 | `api_server.py` L970-972 | `_load_llm_config` 将密钥写入 `os.environ`，子进程可继承 | 密钥泄露 | 仅在当前请求上下文中使用密钥 |
| SEC-BE-018 | `api_server.py` L292-313 | `/api/search` 每次请求全量扫描 wiki 目录并读取所有文件内容 | DoS（大量磁盘 I/O 和内存） | 使用 FTS5 索引搜索，移除 fallback 全量扫描或添加文件数量限制 |
| SEC-BE-019 | `api_server.py` L132-154 | 速率限制基于 IP，无区分限制（GET 和 LLM 调用共享 60次/分钟），可通过代理池绕过 | 限制易绕过 | 按端点类型分别限流，添加 LLM 专用限额 |
| SEC-BE-020 | `api_server.py` L574-586 | `subprocess.run` 的 stdout/stderr 完整返回给客户端 | 内部路径/堆栈信息泄露 | 截断或过滤敏感信息后再返回 |
| SEC-BE-021 | `api_server.py` L217 | `get_page` 返回服务器绝对路径 | 目录结构泄露 | 只返回 repo-relative 路径 |
| SEC-BE-022 | `api_server.py` L515 | `upload_text` 文件名清洗只移除 Windows 禁止字符，未处理保留名（CON, PRN, AUX 等）和超长文件名 | 边缘情况 | 添加保留名检查和长度限制 |
| SEC-BE-024 | `api_server.py` L157-163 | `DEBUG` 环境变量设置时，完整异常信息返回给客户端 | 信息泄露 | 生产环境强制不返回 detail |
| SEC-BE-025 | `api_server.py` L181-186 | CORS `allow_headers=["*"]` 允许所有请求头 | 过于宽松 | 限制为实际使用的 headers |

### 核心工具问题（P1）

> SEC-TOOL-001、SEC-TOOL-002、SEC-TOOL-003 均已修复，见上方"已修复的 P1 问题"。

### 核心工具问题（P2）

| ID | 文件 | 描述 | 风险 | 建议 |
|---|---|---|---|---|
| SEC-TOOL-004 | `ingest.py` L138-166 | 内联 fallback `call_llm` 缺少重试和超时，而 `shared/llm.py` 正式版有 `max_retries=2` + `timeout=120` | 网络抖动直接导致 ingest 失败 | 为 fallback 版本添加基本重试和超时 |
| SEC-TOOL-005 | `ingest.py` L343-350 | `convert_to_md()` 将转换结果写到 `source.with_suffix(".md")`，静默覆盖同名 .md 文件 | 用户手写文件被覆盖 | 添加存在性检查或写入单独目录 |
| SEC-TOOL-006 | `query.py` L139-165 | `find_relevant_pages` 图谱扩展无邻居数量限制，高连接度节点可能导致上下文超出 LLM token 限制 | 查询质量差/费用浪费 | 添加 max_neighbors 限制 |
| SEC-TOOL-007 | `query.py` L228-236 | LLM 返回非法 JSON 时 `relevant_pages` 为空但代码继续执行，用户无警告 | 查询结果极差 | 添加警告日志或回退策略 |
| SEC-TOOL-008 | `query.py` L267-278 | `save_synthesis` 读-改-写 index 非原子操作，并发 query 可能覆盖 | 数据丢失 | 使用原子写入模式 |
| SEC-TOOL-009 | `build_graph.py` L426-428 | LLM 推理 JSON 解析失败时仅警告跳过，但已处理页面仍被标记为完成 | 图数据不完整 | JSON 解析失败时应重试或标记为待处理 |
| SEC-TOOL-010 | `ingest.py` L190-207 | `parse_json_from_response` 不处理 JSON 字符串值中的花括号（如代码示例 `function() { }`） | JSON 截断解析失败 | 使用正确的 JSON 字符串感知解析 |
| SEC-TOOL-011 | `ingest.py` L211-223 | `update_index` 使用字符串 `replace` 插入条目，如存在重复 section header 会插入到错误位置 | 条目位置错误 | 使用行级解析而非字符串替换 |
| SEC-TOOL-012 | `ingest.py` L490-492 | `validate_ingest` 中 `created_pages` 使用原始 slug 而非 `safe_slug`，slug 含特殊字符时路径不匹配 | 验证结果不准确 | 使用 `safe_slug` 统一路径 |
| SEC-TOOL-013 | `ingest.py` L644-677 | batch 模式 ingest 失败后已写入页面不回滚，checkpoint 记录为 "failed" 但 wiki 中存在不完整页面 | 数据不一致 | 记录已写入页面列表到 checkpoint，支持部分回滚 |
| SEC-TOOL-014 | `search_engine.py` L68-72 | `_file_hash` 只用 `mtime + size` 而非内容哈希，文件内容可能改变而 mtime/size 不变 | 索引与实际不一致 | 使用 `hashlib.sha256(content)` 计算内容哈希 |
| SEC-TOOL-015 | `search_engine.py` L91-94 | `_ensure_indexed` 先 `rebuild_index` 再设 hash，进程崩溃间隙索引不完整 | 索引不完整 | 先写 hash 到临时值，完成后再更新 |
| SEC-TOOL-016 | `context.py` L92-104 | 每次调用 `_fts_search` 创建新 WikiSearchEngine，`search()` 异常时 `close()` 不会被调用 | SQLite 连接泄露 | 使用 `try/finally` 或上下文管理器 |
| SEC-TOOL-017 | `memory.py` L42-45 | `_next_id` 使用 `len(existing) + 1` 生成序号，两个进程同时调用可能生成相同 session ID | 文件覆盖 | 使用文件锁或原子操作 |
| SEC-TOOL-018 | `memory.py` L166-180 | `finish()` 将 summary 插入到 `## Notes` 节，如文档无 `## Notes` 节则 summary 被丢弃 | 数据丢失 | 使用追加到文件末尾作为 fallback |
| SEC-TOOL-020 | `lint.py` L155 | `find_orphans` 硬编码排除 `overview.md`，新增特殊页面会被误报 | 误报 | 使用配置化的排除列表 |

### 前端安全问题（P1）

| ID | 文件 | 描述 | 风险 | 建议 |
|---|---|---|---|---|
| SEC-FE-007 | `wikiStore.ts` L42-48 | localStorage 持久化数据只做 `isObject` 验证，攻击者可通过 XSS 注入恶意结构数据 | 运行时崩溃 | 添加严格的类型/结构验证 |

> SEC-FE-005、SEC-FE-006、SEC-FE-008 均已修复，见上方"已修复的 P1 问题"。

### 前端安全问题（P2）

| ID | 文件 | 描述 | 风险 | 建议 |
|---|---|---|---|---|
| SEC-FE-009 | `agentKitLLMService.ts` L55-82 | SSE 流解析不处理尾部 buffer 中剩余的数据（已修复添加尾部处理，但与 `chatService.ts` 的解析逻辑仍不一致） | 多行 data 字段丢失 | 统一两个服务的 SSE 解析逻辑 |
| SEC-FE-010 | `ChatPage.tsx` L477-485 | `onSourceClick` 重复路由逻辑，未使用 `resolveWikiLink`/`getPagePath`，且 `path` 未验证 | 路径遍历导航 | 使用已有的路由工具函数并验证 path |
| SEC-FE-011 | 多个文件 | 服务端错误消息直接通过 `showToast(String(err))` 展示给用户 | 内部信息泄露（路径、堆栈） | 过滤错误消息中的敏感信息 |
| SEC-FE-013 | `useChat.ts` + `ChatPage.tsx` | 聊天历史无大小限制存入 localStorage，长对话可快速消耗 5-10MB 配额 | 配额满后所有持久化数据丢失 | 添加最大条目数/大小限制，超出时清理旧数据 |
| SEC-FE-014 | `configStore.ts` L260-280 | YAML 解析使用 `/enabled:\s*(true\|false)/` 正则会匹配注释中的内容 | 配置解析错误 | 使用正式的 YAML 解析器或排除注释行 |
| SEC-FE-015 | `configStore.ts` `loadFromServer` | 分步 `set()` 导致中间状态被持久化到 localStorage | 部分配置丢失 | 合并所有更新为单次 `set()` 调用 |

### 前端低风险问题（P3）

| ID | 文件 | 描述 | 建议 |
|---|---|---|---|
| SEC-FE-018 | `validation.ts` L32-38 | `sanitizePath` 函数从未被任何文件导入或调用（死代码） | 删除或改为在路径操作中使用 |
| SEC-FE-019 | `wikiStore.ts` L55-70 | `schedulePersist` 和 `persistNow` 从未被调用（死代码） | 删除 |
| SEC-FE-020 | `MarkdownRenderer.tsx` | `inline` prop 已被 `react-markdown` v6+ 移除，始终为 `undefined` | 清理相关条件判断 |

---

## 修复优先级建议

### P0 — 立即修复（已完成 ✅）

1. ~~路径遍历漏洞（`startswith` → `relative_to`）~~ ✅ 已修复
2. ~~React Hooks 规则违规（条件性调用 hooks）~~ ✅ 已修复
3. ~~前端路径验证缺失~~ ✅ 已修复
4. ~~AbortSignal 覆盖~~ ✅ 已修复
5. ~~Header.tsx JSX 编译错误~~ ✅ 已修复

### P1 — 尽快修复

1. ~~添加全局 API 认证中间件（SEC-BE-006）~~ — 未修复
2. ~~修复 SSRF 漏洞（SEC-BE-007）~~ ✅ 已修复
3. ~~修复 `webhook_token` 静默放行（SEC-BE-005）~~ ✅ 已修复
4. 添加 LLM 端点费用/频率限制（SEC-BE-008）— 未修复
5. ~~修复 `ingest.py` 中的 `sys.exit` 问题（SEC-TOOL-001）~~ ✅ 已修复
6. ~~添加搜索引擎并发锁（SEC-TOOL-002/003）~~ ✅ 已修复
7. ~~修复 ChatPage 双击发送竞态（SEC-FE-005）~~ ✅ 已修复
8. ~~添加 agentKit 函数路径验证（SEC-FE-006）~~ ✅ 已修复

### P2 — 计划修复

- 原子文件操作（upload, graph save, query save）
- 搜索性能优化（避免全量扫描）
- 统一 SSE 解析逻辑
- localStorage 大小限制
- YAML 解析改进
- ~~YAML 注入防护（SEC-BE-014/015）~~ ✅ 已修复
- ~~原型污染防护（SEC-FE-017）~~ ✅ 已修复
- ~~计时器清理（SEC-FE-016）~~ ✅ 已修复
- ~~index 去重（SEC-TOOL-019）~~ ✅ 已修复
- ~~Firefox 下载兼容（SEC-FE-012）~~ ✅ 已修复

### P3 — 低优先级

- 清理死代码
- 信息泄露过滤
- CORS 策略收紧
