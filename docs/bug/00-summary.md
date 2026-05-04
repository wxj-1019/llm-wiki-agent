# LLM Wiki Agent — 代码审查 & 修复报告

> 审查日期：2026-05-04 | 修复日期：2026-05-05 | 审查范围：30+ 文件 | 总计 117 个问题

---

## 修复统计

| 严重级别 | 总计 | 已修复 | 未修复 | 修复率 |
|---|---|---|---|---|
| **P0（严重）** | 12 | 12 | 0 | **100%** |
| **P1（高）** | 29 | 29 | 0 | **100%** |
| **P2（中）** | 51 | 41 | 10 | **80%** |
| **P3（低）** | 25 | 15 | 10 | **60%** |
| **合计** | **117** | **97** | **20** | **83%** |

> 原始 bug 报告已归档至 [fixed/](fixed/) 目录。

---

## 未修复问题清单（20 个，均为 P2/P3）

### 前端页面 P2（5 个）

| ID | 文件 | 描述 | 原因 |
|---|---|---|---|
| FE-PAGE-023 | BrowsePage.tsx | getBacklinks O(n*m) 排序 | 需要重构 store 层提供 backlinks count map |
| FE-PAGE-026 | GraphPage.tsx | GraphStats 密度公式有向/无向 | 需确认图的语义定义 |
| FE-PAGE-028 | ChatPage.tsx | 会话持久化校验过松 | 边缘场景，影响有限 |
| FE-PAGE-033 | LogPage.tsx | parseLog 排序可能不符合预期 | 需确认 log.md 写入顺序 |
| FE-PAGE-030 | SkillsPage.tsx | 无轮询导致状态过时 | 低优先级 |

### 前端页面 P3（5 个）

| ID | 文件 | 描述 |
|---|---|---|
| FE-PAGE-031 | UploadPage.tsx | 批量 ingest 未收集失败文件 |
| FE-PAGE-032 | UploadPage.tsx | "已摄入" 统计不准确 |
| FE-PAGE-035 | WikiLink.tsx | pipe 处理逻辑冗余 |
| FE-PAGE-047 | UploadPage.tsx | toggleSelectAll 逻辑不准确 |
| FE-PAGE-049 | Sidebar.tsx | 移动端关闭动画期间仍可交互 |

### 后端 P2（5 个）

| ID | 文件 | 描述 |
|---|---|---|
| BE-025 | shared/wiki.py | frontmatter title 正则不匹配多行值 |
| BE-027 | shared/log.py | header 拆分逻辑脆弱 |
| BE-037 | health.py | check_index_sync 过滤条件语义不清 |
| BE-038 | lint.py | find_missing_entities 计数逻辑错误 |
| BE-041 | shared/wiki.py | all_wiki_pages 返回列表而非生成器 |

### 后端 P3（5 个）

| ID | 文件 | 描述 |
|---|---|---|
| BE-028 | shared/graph_html.py | CDN 无 SRI 完整性校验 |
| BE-039 | api_server.py | spa_fallback 可能覆盖 API 错误 |
| BE-042 | health.py | fix_log_coverage 绕过 append_log |
| BE-043 | lint.py | 语义 lint 只采样 20 个页面 |
| BE-044 | build_graph.py | sys.path.insert 可能影响导入 |

---

## 已修复问题汇总（97 个）

### 前端核心（22/22 = 100%）

| ID | 修复方式 |
|---|---|
| FE-CORE-001 | useChat: chatMessagesRef + 函数式更新 |
| FE-CORE-002 | configStore: deepMerge 替代浅合并 |
| FE-CORE-003 | configStore: safeSet 替代裸 localStorage.setItem |
| FE-CORE-004 | wikiStore: 缓存结构校验 Array.isArray |
| FE-CORE-005 | notificationStore: toastTimers Map + 清理 |
| FE-CORE-006 | useChat: 500ms debounce 持久化 |
| FE-CORE-007 | useChat: handleQuickPrompt 改为追加 |
| FE-CORE-008 | useChat: handleQuickPrompt 使用 StreamDeduplicator |
| FE-CORE-009 | streamUtils: _findOverlap 部分重叠检测 |
| FE-CORE-010 | wikiStore: _initPromise 并发保护 |
| FE-CORE-011 | wikiStore: MAX_READING_PROGRESS=100 LRU |
| FE-CORE-012 | search.ts: contentFuse 模块级缓存 |
| FE-CORE-013 | search.ts: /^---\n[\s\S]*?\n---\n/ 正则 |
| FE-CORE-014 | chatService.ts: 多行 data 拼接 |
| FE-CORE-015 | chatService.ts: 流结束后 buffer flush |
| FE-CORE-016 | validation.ts: 空路径返回 '_' |
| FE-CORE-017 | validation.ts: decodeURIComponent 预处理 |
| FE-CORE-018 | configStore: deepMerge(DEFAULT_CONFIG, stored) |
| FE-CORE-019 | router.tsx: 移除子路由重复 errorElement |
| FE-CORE-020 | main.tsx: getElementById null 检查 |
| FE-CORE-021 | dateUtils.ts: 返回 '未知时间' |
| FE-CORE-022 | wikiStore: subscribe 自动持久化 |

### 前端页面（41/51 = 80%）

| ID | 修复方式 |
|---|---|
| FE-PAGE-001 | ChatPage: entriesRef 避免闭包竞态 |
| FE-PAGE-002 | ChatPage: contextSentRef 标记 |
| FE-PAGE-003 | GraphPage: DataSet ref 公开 API |
| FE-PAGE-004 | MarkdownRenderer: DOMPurify.sanitize |
| FE-PAGE-005 | HomePage: selectedIdx 重置 |
| FE-PAGE-006 | HomePage: randomNode useMemo |
| FE-PAGE-007 | HomePage: copiedTimerRef |
| FE-PAGE-008 | BrowsePage: useEffect 同步 filterType |
| FE-PAGE-009 | PageDetailPage: useMemo 包裹 |
| FE-PAGE-010 | PageDetailPage: FavoriteButton willBeFavorite |
| FE-PAGE-011 | SearchPage: userEditedRef |
| FE-PAGE-012 | ChatPage: ChatEntry.id + key={entry.id} |
| FE-PAGE-013 | ChatPage: setSessions 回调内计算 newActiveId |
| FE-PAGE-014 | MCPPage: 10s 轮询 + visibilityState |
| FE-PAGE-015 | MCPPage: actioningServer per-server |
| FE-PAGE-016 | SettingsPage: timerRef + cleanup |
| FE-PAGE-017 | SettingsPage: catch 显示错误通知 |
| FE-PAGE-018 | MarkdownRenderer: onSourceClickRef |
| FE-PAGE-019 | MarkdownRenderer: useTranslation 移到顶部 |
| FE-PAGE-020 | MarkdownRenderer: React.cloneElement 嵌套 |
| FE-PAGE-021 | HomePage: useMemo for filters |
| FE-PAGE-022 | HomePage: useMemo for recentNodes |
| FE-PAGE-024 | GraphPage: useMemo for nodes/edges |
| FE-PAGE-025 | GraphPage: filterTypes 独立 effect |
| FE-PAGE-027 | SearchPage: .slice(0, 50) |
| FE-PAGE-029 | ChatPage: copiedTimerRef |
| FE-PAGE-034 | StatusPage: useCallback fetchStatus |
| FE-PAGE-036 | CommandPalette: isSep 跳过 separator |
| FE-PAGE-037 | CommandPalette: [allCommands] 依赖 |
| FE-PAGE-038 | Header: debounce cleanup effect |
| FE-PAGE-039 | RootLayout: z-[60] 离线横幅 |
| FE-PAGE-040 | HomePage: role="search" 移到容器 |
| FE-PAGE-041 | BrowsePage: 移除无效 animationDelay |
| FE-PAGE-042 | PageDetailPage: FileQuestion 图标 |
| FE-PAGE-043 | PageDetailPage: typeColors 统一 |
| FE-PAGE-044 | GraphPage: onboard stopPropagation |
| FE-PAGE-045 | MCPPage: alert → addNotification |
| FE-PAGE-046 | MCPPage: useCallback action |
| FE-PAGE-048 | MarkdownRenderer: 同 FE-PAGE-020 |
| FE-PAGE-050 | Header: AnimatePresence search dropdown |
| FE-PAGE-051 | RootLayout: pt-[6.5rem] 离线补偿 |

### 后端（34/44 = 77%）

| ID | 修复方式 |
|---|---|
| BE-001 | api_server: resolve + startswith 路径遍历 |
| BE-002 | api_server: .cache/llm_api_key 独立存储 |
| BE-003 | api_server: ALLOWED_CONFIG_NAMES 白名单 |
| BE-004 | api_server: 300s 定期清理 rate limiter |
| BE-006 | mcp_manager: _SAFE_NAME_RE 正则 |
| BE-007 | mcp_manager: URL scheme 白名单 |
| BE-008 | mcp_manager: 包名正则 + 白名单 + --target |
| BE-009 | skill_engine: _SAFE_NAME_RE 正则 |
| BE-010 | ingest: 返回 dict 而非 None |
| BE-011 | api_server: limit 分页参数 |
| BE-012 | api_server: 流式写入磁盘 |
| BE-013 | api_server: 5s TTL 内存缓存 |
| BE-014 | api_server: 错误时发送 [DONE] |
| BE-015 | api_server: 移除 wiki_dir 泄露 |
| BE-016 | mcp_manager: text=True errors=replace |
| BE-017 | mcp_manager: deque(maxlen=500) + 2000字截断 |
| BE-018 | mcp_manager: uninstall _SAFE_NAME_RE 校验 |
| BE-019 | mcp_manager: 合并而非覆盖 |
| BE-020 | skill_engine: replace("..", "_") |
| BE-021 | skill_engine: max_scanned=500 限制 |
| BE-022 | skill_engine: SandboxedEnvironment |
| BE-023 | paths.py: Windows 保留文件名 |
| BE-024 | llm.py: retry + timeout + 指数退避 |
| BE-026 | log.py: tmp 文件原子写入 |
| BE-030 | ingest: max_page_chars=2000 截断 |
| BE-031 | ingest: resolve + startswith 校验 |
| BE-032 | ingest: 平衡括号匹配 |
| BE-033 | query.py: resolve + startswith 校验 |
| BE-034 | build_graph: 移除 markdown 字段 |
| BE-035 | build_graph: 预构建 node_list |
| BE-036 | build_graph: 保留方向性去重 |
| BE-040 | llm.py: logging.warning 提示 |
| BE-047 | query.py: sys.stdin.isatty() 检查 |
| BE-048 | ingest: 删除重复赋值 |
