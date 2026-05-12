# LLM Wiki Agent — 端到端测试方案

> 版本: v1.0 | 日期: 2026-05-11
> 覆盖范围: 22 个前端页面、100 个 API 端点、51 个 CLI 工具、260+ 功能模块

---

## 一、测试环境要求

### 1.1 基础设施

| 组件 | 最低要求 | 验证命令 |
|---|---|---|
| Python | 3.10+ | `python --version` |
| Node.js | 18+ | `node --version` |
| LLM API Key | Anthropic / OpenAI / Gemini 任一 | `echo $ANTHROPIC_API_KEY` |
| 浏览器 | Chrome 120+ | - |

### 1.2 服务启动顺序

```bash
pip install -r requirements.txt
cd wiki-viewer && npm install && cd ..
python tools/api_server.py --port 8666 &
cd wiki-viewer && npm run dev &
curl http://localhost:8666/api/health
```

### 1.3 测试数据准备

在 `raw/test-e2e/` 下准备包含实体、概念、wikilink 的测试文档，覆盖中英文内容。

---

## 二、测试指标体系

### 2.1 功能正确性指标

| 指标 ID | 指标名称 | 度量方法 | 通过标准 |
|---|---|---|---|
| FC-01 | API 响应正确率 | 正确响应数 / 总请求数 | ≥ 99% |
| FC-02 | 数据完整性 | 创建→读取→验证一致率 | 100% |
| FC-03 | 搜索召回率 | 返回相关结果 / 总相关结果 | ≥ 80% |
| FC-04 | Wikilink 解析率 | 正确解析链接数 / 总链接数 | 100% |
| FC-05 | Frontmatter 完整率 | 完整 frontmatter 页面 / 总页面 | 100% |
| FC-06 | SSE 流完整性 | 收到 [DONE] 的流 / 总流 | 100% |
| FC-07 | 错误处理覆盖率 | 合理错误消息 / 异常场景 | 100% |

### 2.2 性能指标

| 指标 ID | 指标名称 | 通过标准 |
|---|---|---|
| PF-01 | API 非流式 P95 延迟 | < 500ms |
| PF-02 | 首屏渲染 FCP | < 1.5s |
| PF-03 | 搜索响应时间 | < 300ms |
| PF-04 | SSE 首 chunk 延迟 | < 3s |
| PF-05 | 图谱加载时间 | < 5s |
| PF-06 | Ingest 吞吐量 | ≥ 2 docs/min |
| PF-07 | 内存稳定性 (30min) | 增长 < 20% |
| PF-08 | 10 并发请求成功率 | ≥ 95% |

### 2.3 安全性指标

| 指标 ID | 指标名称 | 通过标准 |
|---|---|---|
| SC-01 | 路径穿越防护 | 请求被拒绝 |
| SC-02 | XSS 防护 | 不执行脚本 |
| SC-03 | API Key 不泄露 | 响应中无完整 key |
| SC-04 | 输入验证 | 非法输入返回 4xx |
| SC-05 | SSE 超时处理 | 60s 内客户端断开 |

### 2.4 前端质量指标

| 指标 ID | 指标名称 | 通过标准 |
|---|---|---|
| UI-01 | TypeScript 编译 | 零错误 |
| UI-02 | ESLint | 零错误 |
| UI-03 | 生产构建 | 成功 |
| UI-04 | Lighthouse 评分 | ≥ 80 |
| UI-05 | 控制台零错误 | 零 console.error |
| UI-06 | 响应式 (375/768/1440) | 无布局崩溃 |
| UI-07 | i18n 完整性 | 无遗漏 key |

---

## 三、测试用例

### Module 1: 系统健康与基础设施

#### TC-1.1: API 服务器启动与健康检查

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 启动 api_server | 5s 内启动无报错 | PF-01 |
| 2 | `GET /api/health` | `{"status": "ok"}` | FC-01 |
| 3 | `GET /api/status` | 返回 pages_count, graph_stats | FC-01 |
| 4 | `GET /api/config/llm` | api_key 被脱敏 `***` | SC-03 |
| 5 | 检查 CORS 头 | `Access-Control-Allow-Origin` 存在 | FC-01 |

#### TC-1.2: 前端构建与启动

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | 零错误 | UI-01 |
| 2 | `npm run lint` | 零错误 | UI-02 |
| 3 | `npx vite build` | 构建成功 | UI-03 |
| 4 | `npm run dev` | 3666 端口启动 | PF-02 |
| 5 | 访问首页 | 1.5s 内渲染 | PF-02 |

#### TC-1.3: Python Health Check

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `python tools/health.py` | 0 空文件、0 索引不同步 | FC-02 |
| 2 | `python tools/health.py --json` | 合法 JSON | FC-01 |
| 3 | `python tools/health.py --save` | 生成 health-report.md | FC-02 |

---

### Module 2: 文档上传与 Ingest 管道

#### TC-2.1: 文件上传 API

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `POST /api/upload/file` 上传 .md | 返回文件路径 | FC-01 |
| 2 | `GET /api/raw-files` | 列表包含新文件 | FC-02 |
| 3 | `GET /api/raw-file-content` | 返回完整内容 | FC-02 |
| 4 | 上传同名文件 | 返回带后缀路径不覆盖 | SC-04 |
| 5 | 上传 .pdf 文件 | 自动转换后保存 | FC-01 |

#### TC-2.2: 文本上传 API

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `POST /api/upload/text` 发送 title+content | 保存为 .md | FC-01 |
| 2 | 发送空 title | 返回 422 | SC-04 |
| 3 | 发送空 content | 返回 422 | SC-04 |

#### TC-2.3: Ingest 执行

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `POST /api/ingest` 触发 ingest | returncode=0 | FC-01 |
| 2 | 检查 `wiki/sources/` | 新建源页面 | FC-02 |
| 3 | 检查源页面 frontmatter | 含 title/type/date/source_file | FC-05 |
| 4 | 检查 `wiki/index.md` | Sources 区新增条目 | FC-02 |
| 5 | 检查 `wiki/log.md` | 新增 ingest 日志 | FC-02 |
| 6 | 检查 entity 页面 | 创建相关实体页 | FC-02 |
| 7 | 检查 wikilinks | 新页面包含 [[Entity]] 链接 | FC-04 |
| 8 | Ingest 不存在文件 | 返回错误不崩溃 | FC-07 |

#### TC-2.4: Ingest SSE 流

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `GET /api/ingest/stream` | 返回 SSE 流 | FC-06 |
| 2 | 收到 start 事件 | 第一个事件 | PF-04 |
| 3 | 收到多个 log 事件 | 进度更新 | FC-06 |
| 4 | 收到 complete 事件 | 正常完成 | FC-06 |

#### TC-2.5: 前端 Upload 页面

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 导航到 `/upload` | 拖拽区域渲染 | UI-05 |
| 2 | 拖拽 .md 文件 | 上传成功 toast | FC-01 |
| 3 | 粘贴文本模式 | 输入标题内容可上传 | FC-01 |
| 4 | 全程检查控制台 | 零错误 | UI-05 |

---

### Module 3: 搜索系统

#### TC-3.1: FTS5 全文搜索 API

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 搜索 "transformer" | 返回相关结果 | FC-03 |
| 2 | 搜索中文 "注意力机制" | 返回中文结果 | FC-03 |
| 3 | 空查询 | 空数组或 422 | SC-04 |
| 4 | 不存在关键词 | 空数组 | FC-01 |
| 5 | 搜索性能 | < 300ms | PF-03 |

#### TC-3.2: 前端搜索页面

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 导航到 `/search` | 搜索框获得焦点 | UI-05 |
| 2 | 输入关键词等待 debounce | 显示结果列表 | PF-03 |
| 3 | 切换 Results/Chat/Generate Tab | 正确切换 | UI-05 |
| 4 | 切换 Semantic 开关 | 保存到 localStorage | FC-02 |
| 5 | 点击 Reindex | loading 后成功 toast | FC-01 |

---

### Module 4: AI 对话系统

#### TC-4.1: Wiki Chat API (SSE)

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `POST /api/wiki-chat` 发送 query | SSE 流返回 | FC-06 |
| 2 | 收到 chunk 事件 | 流式内容 | PF-04 |
| 3 | 收到 sources 事件 | 包含 wiki 页面路径 | FC-03 |
| 4 | 收到 [DONE] | 流正常终止 | FC-06 |
| 5 | 带历史消息请求 | 不重复 user message | FC-01 |

#### TC-4.2: Wiki Chat 前端 (ChatTab)

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 输入 "What is Transformer?" 发送 | 流式渲染回复 | PF-04 |
| 2 | 消息显示 sources 链接 | 点击跳转 wiki 页面 | FC-04 |
| 3 | 发送第二条消息 | 第一条保留，历史连续 | FC-02 |
| 4 | 发送空消息 | 不触发发送 | SC-04 |
| 5 | 流式中切换到 Search Tab | 流中断，chatStreaming 恢复 | FC-01 |
| 6 | 切回 Chat Tab | 之前对话保留 | FC-02 |
| 7 | 点击 Clear | 对话清空 | FC-01 |
| 8 | 后端错误 | 显示红色错误消息 | FC-07 |

#### TC-4.3: LLM Chat API (Agent Kit)

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `POST /api/agent-kit/llm-chat` | 返回回复内容 | FC-01 |
| 2 | `POST /api/agent-kit/llm-chat-stream` | SSE 流式返回 | FC-06 |
| 3 | 空 messages | 返回验证错误 | SC-04 |

#### TC-4.4: SSE 超时与错误处理

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 模拟后端超时 | 60s 后前端显示超时 | SC-05 |
| 2 | SSE 连接中断 | 显示断开提示 | FC-07 |
| 3 | AbortController 取消 | 流立即停止 | FC-01 |
| 4 | error chunk | 红色错误消息 | FC-07 |

---

### Module 5: Wiki 页面浏览

#### TC-5.1: 首页 (HomePage)

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 导航到 `/` | 仪表盘渲染 | PF-02 |
| 2 | 统计数字 | 页面数/实体数/概念数正确 | FC-02 |
| 3 | 快速导航链接 | 正确跳转 | UI-05 |

#### TC-5.2: 浏览页 (BrowsePage)

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 导航到 `/browse` | 按类型分组列表 | FC-02 |
| 2 | 切换类型筛选 | 列表更新 | UI-05 |
| 3 | 点击页面条目 | 跳转详情页 | FC-04 |

#### TC-5.3: 页面详情 (PageDetailPage)

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 导航到 `/s/slug` | 渲染 markdown | FC-02 |
| 2 | 点击 [[Wikilink]] | 跳转对应页面 | FC-04 |
| 3 | 收藏按钮 | 添加/移除收藏 | FC-02 |
| 4 | 不存在的 slug | 显示未找到 | FC-07 |

#### TC-5.4: 操作日志 (LogPage)

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 导航到 `/log` | 时间排列的日志条目 | FC-02 |
| 2 | 日志格式 | `## [YYYY-MM-DD] op \| title` | FC-05 |

---

### Module 6: 知识图谱

#### TC-6.1: 图谱构建 API

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `POST /api/tools/build-graph` | 构建成功 | FC-01 |
| 2 | `GET /api/graph` | 返回 nodes + edges | FC-02 |
| 3 | `GET /api/graph/stats` | 返回统计 | FC-01 |
| 4 | `graph/graph.json` | JSON 合法 | FC-02 |
| 5 | `graph/graph.html` | 含 vis.js | FC-02 |

#### TC-6.2: 图谱可视化 (GraphPage)

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 导航到 `/graph` | vis-network 渲染 | PF-05 |
| 2 | 拖拽/缩放节点 | 平滑交互 | UI-05 |
| 3 | 点击节点 | 显示详情面板 | FC-01 |

#### TC-6.3: 图谱健康报告

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `build_graph.py --report` | 健康摘要输出 | FC-01 |
| 2 | 孤儿节点/God 节点/脆弱桥接 | 正确识别 | FC-01 |

---

### Module 7: 爬虫与自动化管道

#### TC-7.1: 爬虫 API

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `POST /api/fetch/url` 抓取 URL | 保存到 fetched/ | FC-01 |
| 2 | 无效 URL | 返回错误 | SC-04 |
| 3 | `POST /api/crawler/run` | Web 爬取成功 | FC-01 |
| 4 | `POST /api/crawler/run/rss` | RSS 爬取成功 | FC-01 |
| 5 | `POST /api/crawler/run/github` | GitHub 爬取成功 | FC-01 |
| 6 | `POST /api/crawler/run/arxiv` | arXiv 爬取成功 | FC-01 |
| 7 | `POST /api/crawler/batch` | 批处理管道成功 | FC-01 |

#### TC-7.2: 前端 CrawlerPage

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 导航到 `/crawler` | 配置面板渲染 | UI-05 |
| 2 | 配置 Web 源保存 | YAML 持久化 | FC-02 |
| 3 | 运行爬虫按钮 | 进度 + 统计 | FC-01 |

---

### Module 8: 配置管理

#### TC-8.1: YAML 配置 API

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `GET /api/config/rss_sources` | 返回 YAML | FC-01 |
| 2 | `POST /api/config/rss_sources` | 配置更新 | FC-02 |
| 3 | `GET /api/config/nonexistent` | 返回 404 | FC-07 |
| 4 | 路径穿越 `../../etc/passwd` | 返回 400/403 | SC-01 |

#### TC-8.2: LLM 配置

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `GET /api/llm-config` | key 脱敏 | SC-03 |
| 2 | `POST /api/llm-config` 更新 | 后续调用用新模型 | FC-02 |

#### TC-8.3: 前端 SettingsPage

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 导航到 `/settings` | 配置表单渲染 | UI-05 |
| 2 | 修改 LLM 模型保存 | 成功 toast | FC-01 |
| 3 | 修改 RSS 源保存 | 配置持久化 | FC-02 |

---

### Module 9: Agent Kit 生成

#### TC-9.1: Agent Kit 生命周期

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `GET /api/agent-kit/status` | 返回生成状态 | FC-01 |
| 2 | `POST /api/agent-kit/generate` | 触发生成 | FC-01 |
| 3 | `GET /api/agent-kit/files` | 列出文件 | FC-02 |
| 4 | `GET /api/agent-kit/download` | 下载单文件 | FC-01 |
| 5 | `POST /api/agent-kit/download-zip` | 下载 ZIP | FC-01 |

#### TC-9.2: 知识生成

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `POST /api/agent-kit/generate-from-knowledge` | 返回代码+sources | FC-01 |
| 2 | sources 非空 | 含 wiki 页面路径 | FC-03 |

---

### Module 10: MCP 服务器管理

#### TC-10.1: MCP CRUD

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `POST /api/mcp/install` | 安装成功 | FC-01 |
| 2 | `GET /api/mcp/list` | 列表含新服务器 | FC-02 |
| 3 | `POST /api/mcp/start/{name}` | 启动成功 | FC-01 |
| 4 | `GET /api/mcp/status/{name}` | running 状态 | FC-02 |
| 5 | `POST /api/mcp/test/{name}` | 测试连接成功 | FC-01 |
| 6 | `POST /api/mcp/stop/{name}` | 停止成功 | FC-01 |
| 7 | `DELETE /api/mcp/uninstall/{name}` | 卸载成功 | FC-01 |

---

### Module 11: 技能管理

#### TC-11.1: Skills CRUD

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `POST /api/skills/install` | 安装成功 | FC-01 |
| 2 | `GET /api/skills/list` | 列表含新技能 | FC-02 |
| 3 | `POST /api/skills/enable/{name}` | 启用 | FC-01 |
| 4 | `POST /api/skills/execute/{name}` | 执行返回结果 | FC-01 |
| 5 | `POST /api/skills/disable/{name}` | 禁用 | FC-01 |
| 6 | `DELETE /api/skills/uninstall/{name}` | 卸载 | FC-01 |
| 7 | `POST /api/skills/match` | 返回匹配技能 | FC-03 |
| 8 | `GET /api/skills/templates` | 返回模板列表 | FC-01 |

---

### Module 12: Jarvis 自主代理

#### TC-12.1: Jarvis 生命周期

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `GET /api/jarvis/status` | 返回代理状态 | FC-01 |
| 2 | `GET /api/jarvis/tools` | 返回工具列表 | FC-01 |
| 3 | `GET /api/jarvis/strategies` | 返回策略列表 | FC-01 |
| 4 | `POST /api/jarvis/start` | 启动成功 | FC-01 |
| 5 | `POST /api/jarvis/stop` | 停止成功 | FC-01 |

#### TC-12.2: 目标与审批

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `POST /api/jarvis/goals` | 返回目标 ID | FC-01 |
| 2 | `GET /api/jarvis/goals` | 列出目标 | FC-02 |
| 3 | `GET /api/jarvis/approvals` | 返回审批队列 | FC-01 |
| 4 | `POST /api/jarvis/approvals/{id}/approve` | 审批通过 | FC-01 |
| 5 | `POST /api/jarvis/approvals/{id}/reject` | 审批拒绝 | FC-01 |

#### TC-12.3: Jarvis SSE 对话

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `POST /api/agent/chat` | SSE 流返回 | FC-06 |
| 2 | 收到 plan/step_start/tool_call 事件 | 格式正确 | FC-01 |
| 3 | 收到 content 事件 | 代理回复 | FC-01 |
| 4 | 收到 done 事件 | 流终止 | FC-06 |

#### TC-12.4: Jarvis 前端

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 导航到 `/jarvis` | 仪表盘渲染 | UI-05 |
| 2 | 输入目标执行 | SSE 流式步骤展示 | PF-04 |
| 3 | 工具调用展示 | 显示名称/参数/结果 | FC-01 |
| 4 | 审批请求 | 显示审批面板 | FC-01 |

#### TC-12.5: 学习与审计

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `GET /api/jarvis/learning` | 返回学习数据 | FC-01 |
| 2 | `GET /api/jarvis/audit` | 返回审计日志 | FC-01 |
| 3 | `GET /api/jarvis/executions` | 返回执行历史 | FC-01 |
| 4 | `GET /api/jarvis/executions/{id}` | 返回完整记录 | FC-02 |

---

### Module 13: Webhook 与集成

#### TC-13.1: Clip Webhook

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `POST /api/webhook/clip` url+title+content | 保存为 .md | FC-01 |
| 2 | 空 content | 返回 422 | SC-04 |

#### TC-13.2: GitHub Webhook

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `POST /api/webhook/github` 模拟 push | 处理成功 | FC-01 |

---

### Module 14: 前端全局功能

#### TC-14.1: 导航与路由

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 侧边栏导航 | 正确路由 | FC-04 |
| 2 | 浏览器前进/后退 | 页面正确切换 | UI-05 |
| 3 | 刷新页面 | 状态恢复 | FC-02 |
| 4 | `/nonexistent` | 404 页面 | FC-07 |

#### TC-14.2: 主题切换

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 切换 light/dark | 主题变化 | UI-05 |
| 2 | 刷新页面 | 主题保持 | FC-02 |

#### TC-14.3: i18n 国际化

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 切换中文 | 全部中文 | UI-07 |
| 2 | 切换英文 | 全部英文 | UI-07 |
| 3 | `python tools/check_i18n.py` | 无遗漏 key | UI-07 |

#### TC-14.4: PWA 支持

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | manifest.json | 存在且配置正确 | UI-05 |
| 2 | Service Worker | 注册成功 | UI-05 |
| 3 | 离线访问 | 缓存页面可访问 | FC-02 |

#### TC-14.5: 键盘快捷键

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 按 `/` | 跳转搜索框 | UI-05 |
| 2 | 按 `g h` | 跳转首页 | UI-05 |
| 3 | 按 `g g` | 跳转图谱 | UI-05 |
| 4 | 按 `?` | 显示帮助 | UI-05 |

#### TC-14.6: 响应式布局

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 1440px | 正常桌面布局 | UI-06 |
| 2 | 768px | 侧边栏折叠 | UI-06 |
| 3 | 375px | 移动端布局 | UI-06 |

---

### Module 15: 安全性测试

#### TC-15.1: 路径穿越防护

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | `GET /api/raw-file-content?path=../../etc/passwd` | 400/403 | SC-01 |
| 2 | `DELETE /api/raw-files/../../etc/passwd` | 400/403 | SC-01 |
| 3 | `POST /api/wiki/write path=../../../evil.md` | 400/403 | SC-01 |

#### TC-15.2: XSS 防护

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 上传含 `<script>` 的文档 | 内容被转义 | SC-02 |
| 2 | wiki 页面恶意 HTML | DOMPurify 清理 | SC-02 |
| 3 | graph.html | `</script>` 被转义 | SC-02 |

#### TC-15.3: 输入验证

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 超长查询 (>10000 字符) | 422 或截断 | SC-04 |
| 2 | 特殊字符 `{}[]<>&` | 正确处理或拒绝 | SC-04 |
| 3 | JSON 格式错误 | 422 | SC-04 |

---

### Module 16: 端到端集成场景

#### TC-16.1: 完整 Ingest → Search → Chat 流程

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 上传文档 | 成功 | FC-01 |
| 2 | 触发 ingest | 创建页面+实体+概念 | FC-02 |
| 3 | 搜索关键词 | 返回相关结果 | FC-03 |
| 4 | AI Chat 提问 | 引用 ingest 内容回答 | FC-03 |
| 5 | 构建图谱 | 新节点和边添加 | FC-02 |
| 6 | 浏览图谱 | 可视化显示新连接 | FC-02 |

#### TC-16.2: 多轮对话连贯性

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | "What is Transformer?" | 回答 Transformer | FC-01 |
| 2 | "Who created it?" | 理解 it=Transformer | FC-01 |
| 3 | "What about BERT?" | 补充 BERT 内容 | FC-01 |
| 4 | 检查 chatEntries | 3 条消息都在 | FC-02 |

#### TC-16.3: 自动化管道端到端

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | Web 爬虫 | 内容到 fetched/web/ | FC-01 |
| 2 | auto-ingest | 转换为 wiki 页面 | FC-01 |
| 3 | health check | 无新增问题 | FC-02 |
| 4 | 构建图谱 | 新节点添加 | FC-02 |
| 5 | 搜索新内容 | 可搜索到 | FC-03 |

#### TC-16.4: 并发压力测试

| 步骤 | 操作 | 预期结果 | 指标 |
|---|---|---|---|
| 1 | 10 个并发搜索 | 成功率 ≥ 95% | PF-08 |
| 2 | 5 个并发 chat | 所有流正常完成 | PF-08 |
| 3 | 连续操作 30 分钟 | 内存增长 < 20% | PF-07 |

---

## 四、测试优先级矩阵

| 优先级 | 模块 | 理由 |
|---|---|---|
| **P0 — 必须通过** | TC-1 (基础设施), TC-2 (Ingest), TC-3 (搜索), TC-4 (对话), TC-15 (安全) | 核心路径 + 安全红线 |
| **P1 — 应该通过** | TC-5 (浏览), TC-6 (图谱), TC-8 (配置), TC-16 (集成场景) | 完整用户体验 |
| **P2 — 可延后** | TC-7 (爬虫), TC-9 (Agent Kit), TC-10/11 (MCP/Skills), TC-12 (Jarvis) | 高级功能，依赖外部 |
| **P3 — 锦上添花** | TC-13 (Webhook), TC-14.3-14.5 (i18n/PWA/快捷键) | 非核心体验 |

---

## 五、自动化执行方案

```bash
# 1. Python 后端测试
python tools/health.py --json
pytest tools/test_api_pytest.py -v
pytest tools/test_p1_acceptance.py -v

# 2. 前端测试
cd wiki-viewer
npx tsc --noEmit
npm run lint
npx vite build
npx vitest run

# 3. 安全验证
python -c "
from tools.shared.paths import sanitize_path
assert sanitize_path('../../etc/passwd') is None
print('Path traversal: PASS')
"
```

---

## 六、测试结果记录模板

### 执行记录

| 测试 ID | 模块 | 结果 | 耗时 | 备注 |
|---|---|---|---|---|
| TC-1.1 | 系统健康 | - | - | |

### 指标汇总

| 指标 ID | 实测值 | 通过标准 | 结果 |
|---|---|---|---|
| FC-01 | - | ≥ 99% | - |

### 缺陷追踪

| 缺陷 ID | 关联 TC | 严重度 | 描述 | 状态 |
|---|---|---|---|---|
| - | - | - | - | - |
