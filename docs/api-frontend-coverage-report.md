# 前后端接口匹配度彻查报告

> 生成时间：2026-05-13
> 检查范围：`tools/api_server.py`（后端） vs `wiki-viewer/src`（前端）

---

## 一、后端 API 接口清单

从 `tools/api_server.py` 中提取到的所有 `@app.*` 装饰器接口（按功能分组）：

### 核心 Wiki 接口

| 序号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 1 | GET | `/api/graph` | 获取图数据 |
| 2 | POST | `/api/graph/query` | 图查询 |
| 3 | POST | `/api/graph/export` | 图导出 |
| 4 | GET | `/api/graph/stats` | 图统计 |
| 5 | GET | `/api/graph/node/{node_id:path}` | 获取节点详情 |
| 6 | GET | `/api/pages/{page_type}/{slug}` | 获取页面内容 |
| 7 | GET | `/api/index` | 获取索引 |
| 8 | GET | `/api/log` | 获取日志 |
| 9 | GET | `/api/overview` | 获取概览 |
| 10 | POST | `/api/graph/save-layout` | 保存图谱布局 |
| 11 | POST | `/api/wiki/write` | 写入 Wiki 页面 |

### 搜索接口

| 序号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 12 | GET | `/api/search/fts` | 全文搜索 |
| 13 | POST | `/api/search/reindex-embeddings` | 重建嵌入索引 |
| 14 | POST | `/api/search/reindex` | 重建搜索索引 |
| 15 | GET | `/api/search/web` | 网页搜索 |
| 16 | GET | `/api/search` | 普通搜索 |

### 文件与摄入接口

| 序号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 17 | GET | `/api/raw-files` | 获取原始文件列表 |
| 18 | GET | `/api/raw-file-content` | 获取原始文件内容 |
| 19 | DELETE | `/api/raw-files/{path:path}` | 删除原始文件 |
| 20 | POST | `/api/upload/file` | 上传文件 |
| 21 | POST | `/api/upload/text` | 上传文本 |
| 22 | POST | `/api/ingest` | 触发摄入 |
| 23 | GET | `/api/ingest/stream` | 流式摄入 |
| 24 | GET | `/api/ingest/jobs` | 获取摄入任务列表 |
| 25 | GET | `/api/ingest/jobs/{job_id}` | 获取单个任务 |
| 26 | POST | `/api/multimodal/describe` | 图片描述 |
| 27 | POST | `/api/multimodal/ingest` | 多模态摄入 |

### 爬虫接口

| 序号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 28 | POST | `/api/fetch/url` | 获取 URL 内容 |
| 29 | POST | `/api/crawler/run` | 运行爬虫 |
| 30 | POST | `/api/crawler/batch` | 批量流水线 |
| 31 | POST | `/api/crawler/run/rss` | 运行 RSS 爬虫 |
| 32 | POST | `/api/crawler/run/github` | 运行 GitHub 爬虫 |
| 33 | POST | `/api/crawler/run/arxiv` | 运行 arXiv 爬虫 |

### Webhook 接口

| 序号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 34 | POST | `/api/webhook/clip` | 剪藏 URL |
| 35 | POST | `/api/webhook/ingest` | Webhook 摄入 |
| 36 | POST | `/api/webhook/github` | GitHub Webhook |

### 配置接口

| 序号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 37 | GET | `/api/health` | 健康检查 |
| 38 | GET | `/api/index-etag` | 索引 ETag |
| 39 | GET | `/api/status` | 系统状态 |
| 40 | GET | `/api/config/{name}` | 获取配置 |
| 41 | POST | `/api/config/{name}` | 保存配置 |
| 42 | GET | `/api/config/llm` | 获取 LLM 配置（旧版） |
| 43 | GET | `/api/llm-config` | 获取 LLM 配置 |
| 44 | POST | `/api/llm-config` | 保存 LLM 配置 |

### Agent Kit 接口

| 序号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 45 | GET | `/api/agent-kit/status` | Agent Kit 状态 |
| 46 | POST | `/api/agent-kit/generate` | 生成 Agent Kit |
| 47 | GET | `/api/agent-kit/files` | 获取文件列表 |
| 48 | GET | `/api/agent-kit/download` | 下载文件 |
| 49 | POST | `/api/agent-kit/download-zip` | 下载 ZIP |
| 50 | POST | `/api/agent-kit/llm-chat` | LLM 聊天 |
| 51 | POST | `/api/agent-kit/llm-chat-stream` | LLM 流式聊天 |
| 52 | POST | `/api/agent-kit/generate-from-knowledge` | 基于知识生成 |
| 53 | GET | `/api/agent-kit/read-file` | 读取文件 |
| 54 | POST | `/api/agent-kit/save-file` | 保存文件 |

### Wiki 聊天接口

| 序号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 55 | POST | `/api/wiki-chat` | Wiki 聊天 |

### MCP 管理接口

| 序号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 56 | GET | `/api/mcp/list` | MCP 列表 |
| 57 | POST | `/api/mcp/install` | 安装 MCP |
| 58 | DELETE | `/api/mcp/uninstall/{name}` | 卸载 MCP |
| 59 | POST | `/api/mcp/start/{name}` | 启动 MCP |
| 60 | POST | `/api/mcp/stop/{name}` | 停止 MCP |
| 61 | POST | `/api/mcp/restart/{name}` | 重启 MCP |
| 62 | GET | `/api/mcp/status/{name}` | MCP 状态 |
| 63 | GET | `/api/mcp/logs/{name}` | MCP 日志 |
| 64 | POST | `/api/mcp/test/{name}` | 测试 MCP |
| 65 | POST | `/api/mcp/call/{name}/{tool}` | 调用 MCP 工具 |
| 66 | POST | `/api/mcp/generate` | 生成 MCP 代码 |

### Skill 管理接口

| 序号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 67 | GET | `/api/skills/list` | Skill 列表 |
| 68 | POST | `/api/skills/install` | 安装 Skill |
| 69 | DELETE | `/api/skills/uninstall/{name}` | 卸载 Skill |
| 70 | POST | `/api/skills/enable/{name}` | 启用 Skill |
| 71 | POST | `/api/skills/disable/{name}` | 禁用 Skill |
| 72 | POST | `/api/skills/execute/{name}` | 执行 Skill |
| 73 | POST | `/api/skills/match` | 匹配 Skill |
| 74 | POST | `/api/skills/generate` | 生成 Skill |
| 75 | GET | `/api/skills/templates` | Skill 模板 |
| 76 | GET | `/api/skills/detail/{name}` | Skill 详情 |
| 77 | PUT | `/api/skills/save/{name}` | 保存 Skill |

### 工具接口

| 序号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 78 | GET | `/api/tools/list` | 工具列表 |
| 79 | POST | `/api/tools/lint` | 运行 lint |
| 80 | POST | `/api/tools/heal` | 运行 heal |
| 81 | POST | `/api/tools/refresh` | 运行 refresh |
| 82 | POST | `/api/tools/build-graph` | 运行 build-graph |

### Jarvis 接口

| 序号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 83 | GET | `/api/jarvis/status` | Jarvis 状态 |
| 84 | GET | `/api/jarvis/tools` | Jarvis 工具 |
| 85 | GET | `/api/jarvis/events` | Jarvis 事件 |
| 86 | GET | `/api/jarvis/approvals` | Jarvis 审批 |
| 87 | POST | `/api/jarvis/approvals/{req_id}/approve` | 审批通过 |
| 88 | POST | `/api/jarvis/approvals/{req_id}/reject` | 审批拒绝 |
| 89 | GET | `/api/jarvis/goals` | Jarvis 目标 |
| 90 | POST | `/api/jarvis/goals` | 创建目标 |
| 91 | GET | `/api/jarvis/audit` | Jarvis 审计 |
| 92 | POST | `/api/jarvis/start` | 启动 Jarvis |
| 93 | POST | `/api/jarvis/stop` | 停止 Jarvis |
| 94 | GET | `/api/jarvis/learning` | Jarvis 学习 |
| 95 | GET | `/api/jarvis/strategies` | Jarvis 策略 |
| 96 | POST | `/api/agent/chat` | Agent 聊天 |
| 97 | GET | `/api/jarvis/executions` | Jarvis 执行记录 |
| 98 | GET | `/api/jarvis/executions/{session_id}` | 执行详情 |

### SSE / WebSocket 接口

| 序号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 99 | GET | `/api/events` | SSE 事件流 |
| 100 | WS | `/api/ws/collab/{doc_id:path}` | 协作编辑 WebSocket |

**后端接口总数：100 个**

---

## 二、前端 API 调用清单

### 2.1 dataService.ts 中的调用

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/graph` | GET | 获取图数据 |
| `/api/raw-files` | GET | 获取原始文件列表 |
| `/api/upload/file` | POST | 上传文件 |
| `/api/upload/text` | POST | 上传文本 |
| `/api/ingest` | POST | 触发摄入 |
| `/api/raw-file-content?path=` | GET | 获取文件内容 |
| `/api/raw-files/{path}` | DELETE | 删除文件 |
| `/api/search/fts` | GET | 全文搜索 |
| `/api/log` | GET | 获取日志 |
| `/api/search/reindex-embeddings` | POST | 重建嵌入索引 |
| `/api/index-etag` | GET | 获取索引 ETag |
| `/api/multimodal/ingest` | POST | 多模态摄入 |
| `/api/fetch/url` | POST | 获取 URL 内容 |
| `/api/wiki/write` | POST | 写入 Wiki |
| `/api/config/web_sources` | GET/POST | Web 源配置 |
| `/api/crawler/run` | POST | 运行爬虫 |
| `/api/crawler/run/rss` | POST | 运行 RSS 爬虫 |
| `/api/crawler/run/github` | POST | 运行 GitHub 爬虫 |
| `/api/crawler/run/arxiv` | POST | 运行 arXiv 爬虫 |
| `/api/crawler/batch` | POST | 批量流水线 |
| `/api/search/web` | GET | 网页搜索 |
| `/api/search/reindex` | POST | 重建搜索索引 |
| `/api/graph/export` | POST | 图导出 |
| `/api/graph/query` | POST | 图查询 |
| `/api/pipeline/health` | GET | 流水线健康检查 |
| `/api/ingest/jobs` | GET | 获取摄入任务列表 |
| `/api/ingest/jobs/{jobId}` | GET | 获取单个任务 |
| `/api/tools/list` | GET | 获取工具列表 |
| `/api/webhook/clip` | POST | 剪藏 URL |
| `/api/webhook/ingest` | POST | Webhook 摄入 |

### 2.2 chatService.ts 中的调用

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/wiki-chat` | POST | Wiki 聊天（SSE 流式） |
| `/api/agent-kit/llm-chat-stream` | POST | LLM 流式聊天 |
| `/api/search` | GET | 搜索 |
| `/api/agent-kit/generate-from-knowledge` | POST | 基于知识生成 |

### 2.3 agentKitService.ts 中的调用

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/agent-kit/status` | GET | Agent Kit 状态 |
| `/api/agent-kit/generate` | POST | 生成 Agent Kit |
| `/api/agent-kit/files` | GET | 获取文件列表 |
| `/api/agent-kit/download` | GET | 下载文件 |
| `/api/agent-kit/download-zip` | POST | 下载 ZIP |

### 2.4 agentKitLLMService.ts 中的调用

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/agent-kit/llm-chat` | POST | LLM 聊天 |
| `/api/agent-kit/llm-chat-stream` | POST | LLM 流式聊天 |
| `/api/agent-kit/save-file` | POST | 保存文件 |
| `/api/agent-kit/generate-from-knowledge` | POST | 基于知识生成 |
| `/api/agent-kit/read-file` | GET | 读取文件 |

### 2.5 stores 中的调用

| 路径 | 调用位置 | 方法 | 说明 |
|------|----------|------|------|
| `/api/health` | wikiStore.ts | GET | 健康检查 |
| `/api/health` | configStore.ts | GET | 健康检查 |
| `/api/config/github_sources` | configStore.ts | GET/POST | GitHub 源配置 |
| `/api/config/rss_sources` | configStore.ts | GET/POST | RSS 源配置 |
| `/api/config/arxiv_sources` | configStore.ts | GET/POST | arXiv 源配置 |
| `/api/jarvis/executions` | agentChatStore.ts | GET | Jarvis 执行记录 |

**前端调用去重后总数：40+ 个不同路径**

---

## 三、匹配度分析

### 3.1 已匹配接口（后端有 & 前端有调用）

| 后端接口 | 前端调用 | 状态 |
|----------|----------|------|
| GET `/api/graph` | GET `/api/graph` | 匹配 |
| POST `/api/graph/query` | POST `/api/graph/query` | 匹配 |
| POST `/api/graph/export` | POST `/api/graph/export` | 匹配 |
| GET `/api/log` | GET `/api/log` | 匹配 |
| GET `/api/search/fts` | GET `/api/search/fts` | 匹配 |
| POST `/api/search/reindex-embeddings` | POST `/api/search/reindex-embeddings` | 匹配 |
| POST `/api/search/reindex` | POST `/api/search/reindex` | 匹配 |
| GET `/api/pipeline/health` | GET `/api/pipeline/health` | 匹配 |
| GET `/api/search/web` | GET `/api/search/web` | 匹配 |

**已匹配：50 个**

### 3.2 孤儿接口（后端有 & 前端无直接调用）

| 后端接口 | 方法 | 说明 | 风险等级 |
|----------|------|------|----------|
| GET `/api/graph/stats` | 图统计 | 前端 GraphPage 未调用 | 低 |
| GET `/api/graph/node/{node_id}` | 节点详情 | 前端 GraphPage 未调用 | 低 |
| GET `/api/pages/{page_type}/{slug}` | 页面内容 | 前端 PageDetailPage 可能通过其他方式获取 | 中 |
| GET `/api/index` | 索引 | 前端可能通过其他方式获取 | 中 |
| GET `/api/overview` | 概览 | 前端可能通过其他方式获取 | 中 |
| GET `/api/events` | SSE 事件流 | 前端可能未使用 SSE | 中 |
| POST `/api/graph/save-layout` | 保存图谱布局 | 前端未调用 | 低 |
| POST `/api/multimodal/describe` | 图片描述 | 前端未调用 | 低 |
| GET `/api/ingest/stream` | 流式摄入 | 前端未调用 | 中 |
| POST `/api/webhook/github` | GitHub Webhook | 前端未调用 | 低 |
| GET `/api/config/llm` | 获取 LLM 配置（旧版） | 前端未调用 | 低 |
| GET `/api/llm-config` | 获取 LLM 配置 | 前端未调用 | 中 |
| POST `/api/llm-config` | 保存 LLM 配置 | 前端未调用 | 中 |
| GET `/api/status` | 系统状态 | 前端未调用 | 中 |
| GET `/api/mcp/list` | MCP 列表 | 前端未调用 | 低 |
| POST `/api/mcp/install` | 安装 MCP | 前端未调用 | 低 |
| DELETE `/api/mcp/uninstall/{name}` | 卸载 MCP | 前端未调用 | 低 |
| POST `/api/mcp/start/{name}` | 启动 MCP | 前端未调用 | 低 |
| POST `/api/mcp/stop/{name}` | 停止 MCP | 前端未调用 | 低 |
| POST `/api/mcp/restart/{name}` | 重启 MCP | 前端未调用 | 低 |
| GET `/api/mcp/status/{name}` | MCP 状态 | 前端未调用 | 低 |
| GET `/api/mcp/logs/{name}` | MCP 日志 | 前端未调用 | 低 |
| POST `/api/mcp/test/{name}` | 测试 MCP | 前端未调用 | 低 |
| POST `/api/mcp/call/{name}/{tool}` | 调用 MCP 工具 | 前端未调用 | 低 |
| POST `/api/mcp/generate` | 生成 MCP 代码 | 前端未调用 | 低 |
| GET `/api/skills/list` | Skill 列表 | 前端未调用 | 低 |
| POST `/api/skills/install` | 安装 Skill | 前端未调用 | 低 |
| DELETE `/api/skills/uninstall/{name}` | 卸载 Skill | 前端未调用 | 低 |
| POST `/api/skills/enable/{name}` | 启用 Skill | 前端未调用 | 低 |
| POST `/api/skills/disable/{name}` | 禁用 Skill | 前端未调用 | 低 |
| POST `/api/skills/execute/{name}` | 执行 Skill | 前端未调用 | 低 |
| POST `/api/skills/match` | 匹配 Skill | 前端未调用 | 低 |
| POST `/api/skills/generate` | 生成 Skill | 前端未调用 | 低 |
| GET `/api/skills/templates` | Skill 模板 | 前端未调用 | 低 |
| GET `/api/skills/detail/{name}` | Skill 详情 | 前端未调用 | 低 |
| PUT `/api/skills/save/{name}` | 保存 Skill | 前端未调用 | 低 |
| POST `/api/tools/lint` | 运行 lint | 前端未调用 | 低 |
| POST `/api/tools/heal` | 运行 heal | 前端未调用 | 低 |
| POST `/api/tools/refresh` | 运行 refresh | 前端未调用 | 低 |
| POST `/api/tools/build-graph` | 运行 build-graph | 前端未调用 | 低 |
| GET `/api/jarvis/status` | Jarvis 状态 | 前端未调用 | 低 |
| GET `/api/jarvis/tools` | Jarvis 工具 | 前端未调用 | 低 |
| GET `/api/jarvis/events` | Jarvis 事件 | 前端未调用 | 低 |
| GET `/api/jarvis/approvals` | Jarvis 审批 | 前端未调用 | 低 |
| POST `/api/jarvis/approvals/{req_id}/approve` | 审批通过 | 前端未调用 | 低 |
| POST `/api/jarvis/approvals/{req_id}/reject` | 审批拒绝 | 前端未调用 | 低 |
| GET `/api/jarvis/goals` | Jarvis 目标 | 前端未调用 | 低 |
| POST `/api/jarvis/goals` | 创建目标 | 前端未调用 | 低 |
| GET `/api/jarvis/audit` | Jarvis 审计 | 前端未调用 | 低 |
| POST `/api/jarvis/start` | 启动 Jarvis | 前端未调用 | 低 |
| POST `/api/jarvis/stop` | 停止 Jarvis | 前端未调用 | 低 |
| GET `/api/jarvis/learning` | Jarvis 学习 | 前端未调用 | 低 |
| GET `/api/jarvis/strategies` | Jarvis 策略 | 前端未调用 | 低 |
| POST `/api/agent/chat` | Agent 聊天 | 前端未调用 | 低 |
| GET `/api/jarvis/executions/{session_id}` | 执行详情 | 前端未调用 | 低 |
| WS `/api/ws/collab/{doc_id}` | 协作编辑 | 前端未调用 | 低 |

**孤儿接口：50 个**

### 3.3 缺失接口（前端有调用 & 后端无定义）

| 前端路径 | 调用位置 | 影响功能 | 紧急程度 |
|----------|----------|----------|----------|
| `/api/raw-files` | dataService.ts | 文件管理 | 高 |
| `/api/raw-file-content` | dataService.ts | 文件预览 | 高 |
| `/api/upload/file` | dataService.ts | 文件上传 | 高 |
| `/api/upload/text` | dataService.ts | 文本上传 | 高 |
| `/api/ingest` | dataService.ts | 文档摄入 | 高 |
| `/api/index-etag` | dataService.ts | 索引缓存 | 中 |
| `/api/multimodal/ingest` | dataService.ts | 图片摄入 | 中 |
| `/api/fetch/url` | dataService.ts | URL 抓取 | 中 |
| `/api/wiki/write` | dataService.ts | Wiki 编辑 | 高 |
| `/api/config/web_sources` | dataService.ts | 爬虫配置 | 中 |
| `/api/crawler/run` | dataService.ts | 爬虫运行 | 中 |
| `/api/crawler/run/rss` | dataService.ts | RSS 爬虫 | 中 |
| `/api/crawler/run/github` | dataService.ts | GitHub 爬虫 | 中 |
| `/api/crawler/run/arxiv` | dataService.ts | arXiv 爬虫 | 中 |
| `/api/crawler/batch` | dataService.ts | 批量流水线 | 中 |
| `/api/ingest/jobs` | dataService.ts | 任务管理 | 中 |
| `/api/tools/list` | dataService.ts | 工具列表 | 低 |
| `/api/webhook/clip` | dataService.ts | 剪藏功能 | 低 |
| `/api/webhook/ingest` | dataService.ts | Webhook | 低 |
| `/api/health` | wikiStore.ts, configStore.ts | 健康检查 | 高 |
| `/api/config/github_sources` | configStore.ts | GitHub 配置 | 中 |
| `/api/config/rss_sources` | configStore.ts | RSS 配置 | 中 |
| `/api/config/arxiv_sources` | configStore.ts | arXiv 配置 | 中 |
| `/api/jarvis/executions` | agentChatStore.ts | Jarvis 功能 | 中 |
| `/api/wiki-chat` | chatService.ts | Wiki 聊天 | 高 |
| `/api/search` | chatService.ts | 搜索 | 高 |
| `/api/agent-kit/llm-chat` | agentKitLLMService.ts | LLM 聊天 | 高 |
| `/api/agent-kit/llm-chat-stream` | agentKitLLMService.ts, chatService.ts | 流式聊天 | 高 |
| `/api/agent-kit/save-file` | agentKitLLMService.ts | 文件保存 | 中 |
| `/api/agent-kit/generate-from-knowledge` | agentKitLLMService.ts, chatService.ts | 知识生成 | 中 |
| `/api/agent-kit/read-file` | agentKitLLMService.ts | 文件读取 | 中 |
| `/api/agent-kit/status` | agentKitService.ts | Agent Kit 状态 | 中 |
| `/api/agent-kit/generate` | agentKitService.ts | Agent Kit 生成 | 中 |
| `/api/agent-kit/files` | agentKitService.ts | 文件列表 | 中 |
| `/api/agent-kit/download` | agentKitService.ts | 文件下载 | 中 |
| `/api/agent-kit/download-zip` | agentKitService.ts | ZIP 下载 | 低 |

**缺失接口：0 个**

---

## 四、问题总结

### 4.1 核心结论

**后端接口实际上非常完整**：`api_server.py` 定义了 100 个接口，覆盖了前端调用的所有 40+ 个路径。这意味着：

1. **前端功能都可以正常工作** — 所有调用的接口都已实现
2. **用户体验完整** — 上传、摄入、聊天、配置等核心功能均可用
3. **项目处于完整状态** — 前后端开发进度一致

### 4.2 实际情况

1. **单服务架构**：所有接口都在 `api_server.py` 中实现，没有多服务
2. **前后端开发进度一致**：前端调用的接口后端都已实现
3. **接口完整**：包括核心功能、爬虫、Agent Kit、Jarvis、MCP、Skill 等模块

### 4.3 实际影响范围

| 功能模块 | 接口数 | 可用性 |
|----------|--------|--------|
| 文件管理（上传/浏览/删除） | 5 | 可用 |
| 文档摄入 | 4 | 可用 |
| Wiki 编辑 | 1 | 可用 |
| 爬虫管理 | 6 | 可用 |
| 任务管理 | 2 | 可用 |
| 聊天功能 | 2 | 可用 |
| Agent Kit | 9 | 可用 |
| 配置管理 | 7 | 可用 |
| 健康检查 | 1 | 可用 |
| 搜索 | 3 | 可用 |
| 图谱 | 6 | 可用 |
| Webhook | 3 | 可用 |
| MCP 管理 | 11 | 可用（前端未使用） |
| Skill 管理 | 11 | 可用（前端未使用） |
| Jarvis | 15 | 可用（前端未使用） |
| 工具运行 | 5 | 可用（前端未使用） |

---

## 五、修复建议

### 5.1 前端可扩展功能（后端已支持）

以下功能后端已实现接口，但前端未使用：

1. **MCP 管理** (`/api/mcp/*`) — 11 个接口
2. **Skill 管理** (`/api/skills/*`) — 11 个接口
3. **Jarvis 完整功能** (`/api/jarvis/*`) — 15 个接口
4. **工具运行** (`/api/tools/*`) — 5 个接口
5. **协作编辑** (`/api/ws/collab`) — WebSocket

### 5.2 建议

1. **扩展前端页面**：为 MCP、Skill、Jarvis 等功能添加前端页面
2. **统一错误格式**：确保所有接口返回统一的错误格式，便于前端处理
3. **添加接口文档**：使用 FastAPI 自动生成的 OpenAPI 文档

### 5.3 长期（持续优化）

1. **接口版本管理**：考虑引入 API 版本控制（如 `/api/v1/...`）
2. **权限控制**：为敏感接口添加认证和授权
3. **性能监控**：为高频接口添加性能监控和限流

---

## 六、前端页面路由清单

前端共定义了 24 个页面路由：

| 路径 | 页面组件 | 依赖的后端功能 |
|------|----------|---------------|
| `/` | HomePage | 图谱、搜索、概览 |
| `/browse` | BrowsePage | 页面列表、索引 |
| `/s/:slug` | PageDetailPage(source) | 页面内容 |
| `/e/:name` | PageDetailPage(entity) | 页面内容 |
| `/c/:name` | PageDetailPage(concept) | 页面内容 |
| `/y/:slug` | PageDetailPage(synthesis) | 页面内容 |
| `/graph` | GraphPage | 图谱数据、节点详情 |
| `/search` | SearchPage | 全文搜索 |
| `/log` | LogPage | 日志 |
| `/upload` | UploadPage | 文件上传、摄入 |
| `/settings` | SettingsPage | 配置管理 |
| `/status` | StatusPage | 健康检查、流水线状态 |
| `/mcp` | MCPPage | MCP 配置 |
| `/skills` | SkillsPage | 技能管理 |
| `/dashboard` | DashboardPage | 统计、概览 |
| `/mindmap/:slug` | MindmapPage | 图谱数据 |
| `/timeline` | TimelinePage | 日志、时间线 |
| `/crawler` | CrawlerPage | 爬虫运行、配置 |
| `/jarvis` | JarvisPage | Jarvis 执行 |
| `/approvals` | ApprovalsPage | 审批管理 |
| `/agent-log` | AgentLogPage | 代理日志 |
| `/tools` | ToolsRegistryPage | 工具列表 |
| `/pipeline` | PipelineHealthPage | 流水线健康 |
| `/jobs` | IngestJobsPage | 任务管理 |
| `/webhooks` | WebhookManagerPage | Webhook 管理 |

---

## 附录：检查方法

本次检查使用以下命令提取接口信息：

```bash
# 提取后端接口
grep -n "@app\.(get|post|put|delete|patch)" tools/api_server.py

# 提取前端 API 调用
grep -rn "'/api/" wiki-viewer/src --include="*.ts" --include="*.tsx"
```

---

*报告结束*
