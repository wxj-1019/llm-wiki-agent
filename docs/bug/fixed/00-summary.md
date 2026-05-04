# LLM Wiki Agent — 全面代码审查汇总

> 审查日期：2026-05-04 | 审查范围：30+ 文件 | 总计 117 个问题

---

## 统计概览

| 严重级别 | 前端核心 | 前端页面 | 后端 | 合计 |
|---|---|---|---|---|
| **P0（严重）** | 5 | 4 | 3 | **12** |
| **P1（高）** | 6 | 16 | 7 | **29** |
| **P2（中）** | 8 | 19 | 24 | **51** |
| **P3（低）** | 3 | 12 | 10 | **25** |
| **合计** | 22 | 51 | 44 | **117** |

## 详细报告

- [01-frontend-core.md](01-frontend-core.md) — 前端核心逻辑（stores、services、hooks、lib）：22 个问题
- [02-frontend-pages.md](02-frontend-pages.md) — 前端页面组件（18 个组件文件）：51 个问题
- [03-backend.md](03-backend.md) — 后端 API + 工具脚本（15 个 Python 文件）：44 个问题

---

## Top 10 最需优先修复的问题

| 排名 | ID | 文件 | 级别 | 描述 |
|---|---|---|---|---|
| 1 | BE-001 | api_server.py | P0 | `/api/wiki-chat` 的 `context_pages` 无路径遍历校验，可读取任意文件 |
| 2 | FE-CORE-001 | useChat.ts | P0 | `handleSendChat` 闭包捕获过时 `chatMessages`，AI 回复基于错误上下文 |
| 3 | BE-002 | api_server.py | P0 | API key 明文存储在 config/llm.yaml |
| 4 | FE-CORE-002 | configStore.ts | P0 | `setConfig` 浅合并覆盖嵌套配置 |
| 5 | FE-CORE-006 | useChat.ts | P1 | 流式期间每个 chunk 都触发 localStorage 写入，UI 卡顿 |
| 6 | FE-PAGE-004 | MarkdownRenderer.tsx | P0 | `dangerouslySetInnerHTML` 无 sanitizer |
| 7 | FE-PAGE-012 | ChatPage.tsx | P1 | 消息列表用数组索引作 key，regenerate 后内容错乱 |
| 8 | FE-CORE-004 | wikiStore.ts | P0 | 图缓存反序列化无结构校验，损坏缓存导致白屏 |
| 9 | BE-008 | mcp_manager.py | P1 | `pip install` 任意包安装 |
| 10 | FE-PAGE-003 | GraphPage.tsx | P0 | 直接操作 vis-network 内部 API |

---

## 按类别分类

### 安全问题（12 个）

| ID | 描述 |
|---|---|
| BE-001 | context_pages 路径遍历 |
| BE-002 | API key 明文存储 |
| BE-003 | 任意 YAML 写入 |
| BE-006 | MCP manager name 路径遍历 |
| BE-007 | git clone URL 未验证 |
| BE-008 | 任意 pip 包安装 |
| BE-009 | skill engine name 路径遍历 |
| FE-PAGE-004 | dangerouslySetInnerHTML XSS |
| FE-CORE-017 | PATH_TRAVERSAL 不匹配编码变体 |
| BE-022 | Jinja2 SSTI |
| BE-028 | CDN 无 SRI |
| BE-005 | subprocess 命令注入风险 |

### 性能问题（18 个）

| ID | 描述 |
|---|---|
| FE-CORE-006 | 流式期间高频 localStorage 写入 |
| FE-CORE-010 | initialize 并发调用 |
| FE-CORE-011 | readingProgress 无限增长 |
| FE-CORE-012 | searchContent 每次创建新 Fuse 实例 |
| FE-PAGE-009 | parseFrontmatter 无 memo |
| FE-PAGE-021-022 | HomePage 计算无 memo |
| FE-PAGE-023 | getBacklinks O(n*m) |
| FE-PAGE-024 | nodes/edges 无 useMemo |
| FE-PAGE-027 | 搜索结果无限制 |
| FE-PAGE-014 | MCP 轮询 3 秒太频繁 |
| BE-004 | 速率限制器内存泄漏 |
| BE-011 | 搜索 API 无分页 |
| BE-012 | upload 内存风险 |
| BE-013 | llm_config 每次读磁盘 |
| BE-021 | _collect_context 加载所有文件 |
| BE-030 | build_wiki_context 可能超 token |
| BE-034 | graph.json 包含全部 markdown |
| BE-035 | node_list 重复构建 |

### 数据正确性问题（15 个）

| ID | 描述 |
|---|---|
| FE-CORE-001 | useChat 闭包捕获过时状态 |
| FE-CORE-002 | 配置浅合并覆盖嵌套 |
| FE-CORE-007 | handleQuickPrompt 清空历史 |
| FE-CORE-009 | StreamDeduplicator 检测漏洞 |
| FE-PAGE-001 | ChatPage doSend 闭包竞态 |
| FE-PAGE-002 | ChatPage useEffect 竞态 |
| FE-PAGE-008 | BrowsePage filterType 不同步 |
| FE-PAGE-010 | 收藏通知逻辑反转风险 |
| FE-PAGE-011 | SearchPage 覆盖用户输入 |
| FE-PAGE-013 | 删除会话后 activeId 悬空 |
| FE-PAGE-033 | LogPage 排序可能不正确 |
| BE-010 | ingest 返回 None |
| BE-036 | 双向去重丢失方向性 |
| BE-038 | lint 计数逻辑错误 |
| BE-032 | JSON 贪婪匹配错误 |

---

## 修复优先级建议

### 第一轮：安全修复（1-2 天）

- BE-001: context_pages 路径遍历校验
- BE-002: API key 不明文存储
- BE-003: config 写入白名单
- BE-006/009: name 参数白名单
- BE-008: pip install 安全限制
- FE-PAGE-004: 添加 DOMPurify

### 第二轮：核心功能修复（2-3 天）

- FE-CORE-001: useChat 闭包问题
- FE-CORE-006: localStorage debounce
- FE-CORE-002: 深度合并配置
- FE-CORE-004: 缓存结构校验
- FE-PAGE-012: ChatEntry 唯一 id
- FE-PAGE-001-002: ChatPage 竞态

### 第三轮：性能优化（2-3 天）

- FE-CORE-010: initialize 并发保护
- FE-CORE-012: 搜索索引缓存
- FE-PAGE-009: memo 优化
- FE-PAGE-014: 轮询优化
- BE-013: config 缓存
- BE-034: graph.json 瘦身

### 第四轮：代码质量（持续）

- P2/P3 级别的 76 个问题逐步修复
