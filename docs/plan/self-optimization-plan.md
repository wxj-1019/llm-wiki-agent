# LLM Wiki Agent — 自我优化能力分析 & 改进路线图

> 生成日期: 2026-05-10
> 分析范围: 全部 Python 后端 (tools/, tools/agent_kit/, tools/fetchers/, tools/shared/, mcp-servers/, skills/) + React 前端 (wiki-viewer/)

---

## 目录

1. [当前状态总览](#当前状态总览)
2. [系统级关键缺失](#系统级关键缺失)
3. [闭环自优化架构](#闭环自优化架构)
4. [Scheduler 自适应调度](#scheduler-自适应调度)
5. [搜索学习与分析](#搜索学习与分析)
6. [LLM 调用成本优化](#llm-调用成本优化)
7. [抓取器按域名自适应](#抓取器按域名自适应)
8. [知识图谱增量推理](#知识图谱增量推理)
9. [API 缓存与自适应](#api-缓存与自适应)
10. [前端离线与智能预取](#前端离线与智能预取)
11. [Skill/MCP 自优化](#skillmcp-自优化)
12. [共享基础设施优化](#共享基础设施优化)
13. [代码一致性审计](#代码一致性审计)
14. [实现优先级路线图](#实现优先级路线图)

---

## 当前状态总览

你的平台已具备一定的自我维护基础：

| 能力 | 工具 | 触发方式 | 自优化程度 |
|------|------|----------|------------|
| 结构健康检查 | `health.py` | 手动 / scheduler 每周 | 中：有 `--fix` 但只修索引和日志 |
| 自动修复空桩/索引/日志 | `health.py --fix` | 手动 | 低：断裂 wikilink 不修 |
| 缺失实体页生成 | `heal.py` | 手动 | 低：只处理实体不处理概念 |
| 过期源文档归档 | `archive_stale.py` | scheduler 每周 | 低：不回链清理 |
| 内容变更检测+刷新 | `refresh.py` | 手动 | 中：hash 检测准但不验证级联影响 |
| 知识图谱重建 | `build_graph.py` | scheduler 每周 | 低：全量重建无增量 diff |
| 内容质量检查 | `lint.py` | 手动 | 低：发现问题不自动修复 |
| 摄入模式反思 | `reflect.py` | 手动 | 低：分析结果不被任何工具消费 |
| FTS5 搜索索引 | `search_engine.py` | 写入时自动 | 中：嵌入需手动重建 |
| 前端 ETag 轮询+自适应退避 | `wikiStore.ts` | 自动 | 高：当前最强的自优化组件 |
| web_fetcher 三层提取级联 | `web_fetcher.py` | 自动 | 中：质量阈值自适应但硬编码 |

**核心结论：诊断能力强，但诊断 → 修复 → 预防的闭环没有形成。**

---

## 系统级关键缺失

### 1. 没有闭环自优化编排器

```
现状:
  health → 发现问题 → 打印报告 → 人类决定是否处理
  lint   → 发现问题 → 打印报告 → 人类决定是否处理
  heal   → 手动调用
  reflect → 手动调用 → 写入 MEMORY.md → 不再被任何工具读取

理想:
  health → 发现空桩 → 自动 heal
         → 发现索引不同步 → 自动修复
  lint   → 发现缺失实体 → 自动 heal（按引用数排序）
         → 发现数据缺口 → 生成建议 URL → 反馈给 web_fetcher
         → 发现断裂链接 → 自动修复或移除
  build_graph → 发现孤立社区 → 建议连接 → 反馈给 lint
  reflect → 识别内容模式 → 自动建议新抓取源 → 写入配置
```

### 2. 调度器完全是「瞎子」

`scheduler.py` 按固定时间表运行，完全不看历史：

- 某 RSS 源连续 10 次失败 → 照常重试
- 某 arXiv 查询连续 7 天 0 新结果 → 照常查询
- 某抓取器产出突然暴涨 100 倍 → 不报警
- `lint`、`heal`、`reflect` 从未被加入调度 → 永远手动运行

### 3. 搜索不学习

- 用户搜索了什么？哪些查询返回了 0 结果？→ **不记录**
- 新页面摄入后，嵌入向量需要手动重建 → **索引自动过期**
- 零结果搜索时没有模糊匹配建议（"Transfomer" ↔ "Transformer"）

### 4. LLM 调用没有预算意识

`llm_extractor.py` 对每个页面都调 LLM，不管内容是否简单到可以用规则提取：

- 无成本追踪（累计用了多少 token）
- 无模型路由（简单页面用便宜模型，复杂页面用强模型）
- 无内容哈希缓存（同一 HTML 上周提取过，这周重新花 token）

### 5. 所有阈值都是硬编码魔法数字

```
quality thresholds:  70, 40
concurrency:         3
retry count:         2
cache TTL:           5s
debounce:            5s
timeout:             30s
max_input_tokens:    6000
```

这些数字从不根据实际运行数据调整。

### 6. 跨工具代码不一致

`health.py`、`lint.py`、`build_graph.py` 各有自己的 wikilink 提取正则、frontmatter 解析实现。`tools/shared/wiki.py` 已有统一版本，但部分工具仍用内联 fallback，可能导致行为分歧。

---

## 闭环自优化架构

**新建 `tools/self_optimize.py` 作为编排器：**

```
self_optimize.py 执行流程:
┌──────────────────────────────────────────────────────────┐
│  1. health --json  →  检测空桩/索引/日志问题              │
│     ↓ 有空桩                                           │
│  2. heal  →  自动生成缺失页面（按引用数排序）              │
│     ↓                                                  │
│  3. lint --json  →  检测断裂链接/矛盾/数据缺口            │
│     ↓ 有断裂链接                                       │
│  4. 自动修复或标记断裂 [[wikilinks]]                      │
│     ↓ 有数据缺口                                        │
│  5. 生成 suggested_sources.yaml  →  反馈给 web_fetcher   │
│     ↓                                                  │
│  6. refresh  →  刷新变更的源文档                          │
│     ↓                                                  │
│  7. build_graph --diff  →  增量更新知识图谱               │
│     ↓                                                  │
│  8. reflect  →  分析摄入模式  →  建议模板/抓取源          │
│     ↓                                                  │
│  9. 输出变更摘要                                         │
└──────────────────────────────────────────────────────────┘
```

**配置要点：**
- `--dry-run` 预演模式，只报告不执行
- `--auto-fix` 自动修复模式
- `--scope <subsystem>` 仅优化指定子系统
- 每步结果写入 `state/optimize_history.jsonl`

---

## Scheduler 自适应调度

### 当前状态

```python
# scheduler.py — 完全静态
schedule.every().day.at("08:00").do(run_rss)
schedule.every().monday.at("09:30").do(run_batch_compile_and_ingest)
# ... 无历史感知、无失败处理、无降频逻辑
```

### 改进方案

**1. Job 性能指标持久化** — 写入 `state/scheduler_metrics.json`：

```json
{
  "jobs": {
    "rss_fetcher": {
      "last_success": "2026-05-10T08:00:15",
      "last_failure": null,
      "consecutive_failures": 0,
      "consecutive_zero_results": 2,
      "avg_items_per_run": 12.3,
      "avg_duration_sec": 45.2
    }
  }
}
```

**2. 自适应规则：**

| 条件 | 动作 |
|------|------|
| 连续 3 次失败 | 跳过 24h + 写入警告日志 |
| 连续 7 天 0 新结果 | 降频 daily → weekly |
| 突然产出 > 3σ 正常量 | 报警 + 人工审核 |
| 恢复后连续 3 次成功 | 自动恢复原始频率 |

**3. 新增调度项目：**
- 周一维护计划中增加 `lint --auto-fix` 和 `reflect --suggest-skills`
- 增加 `--status` 查看各 job 健康面板

---

## 搜索学习与分析

### 改进方案

**1. 查询分析日志** — `state/search_analytics.jsonl`：

```json
{"timestamp": "2026-05-10T14:32:01", "query": "transformer架构", "results": 5, "source": "api"}
{"timestamp": "2026-05-10T14:33:15", "query": "RAG优化方法", "results": 0, "source": "mcp"}
```

**2. 零结果智能处理：**
- 编辑距离 <3 的模糊匹配 → 返回建议 "Did you mean: Transformer?"
- 高频零结果查询 → 自动报告给 lint 作为数据缺口
- 数据缺口 → 生成 `raw-inbox/suggested_sources.yaml` 供 web_fetcher 消费

**3. 自动索引维护：**
- 新页面摄入后 → API 触发增量 FTS5 重建
- 嵌入向量过期检测 → 自动触发 `rebuild_embeddings()`
- 语义搜索 Ollama 不可用时 → 优雅降级到纯 FTS5（搜索响应中包含 `"semantic_available": false`）

---

## LLM 调用成本优化

### 1. 内容哈希缓存 (`llm_extractor.py`)

```
HTML body SHA256 → 缓存提取结果
同一 URL 同一内容 → 直接复用（0 token 消耗）
缓存 TTL: 7 天
```

### 2. 轻量预分类器（无需 LLM）

```
输入: HTML
规则:
  - text/markup 比例 > 0.5 且含 <article> → "简单" → 便宜模型 (haiku)
  - text/markup 比例 < 0.2 或大量 <nav>/<footer> → "复杂" → 强模型 (sonnet)
  - 中间状态 → 默认模型
```

### 3. 成本追踪

```python
# tools/shared/llm.py
class LLMBudgetTracker:
    daily_budget_usd: float = 5.0
    current_spend: float = 0.0
    warning_threshold: float = 0.8  # 80% 时警告

    def check_budget(self, estimated_tokens: int) -> bool:
        """调用前检查是否超预算"""
```

### 4. per-域名 提取策略缓存 (`web_fetcher.py`)

```
state/domain_extraction_strategy.json:
{
  "arxiv.org":       {"best_engine": "trafilatura", "success_rate": 0.95},
  "medium.com":      {"best_engine": "scrapling",    "success_rate": 0.72},
  "docs.example.com": {"best_engine": "llm_deep",    "success_rate": 0.88}
}
```

同一域名连续 N 次 trafilatura 成功 → 跳过质量评分和中间层，直接 trafilatura。
同一域名永远需要 LLM → 跳过前两层直接 LLM deep extraction。

---

## 抓取器按域名自适应

### `_common.py` 跨抓取器协调层

| 功能 | 说明 |
|------|------|
| 共享重试状态 | 失败 URL + retry 次数 + 上次尝试时间 |
| 内容指纹 cooldown | 相同指纹 3+ 次 → 延长抓取间隔到 7 天 |
| 域名故障汇总 | 按域名分组失败率 → >50% 标记可能死源 |
| 全局速率限制 | 跨抓取器共享 `requests_per_minute` 预算 |

### `rss_fetcher.py`
- 按 feed 追踪成功率和平均响应时间
- 快速 feed 允许更高并发，慢速 feed 降并发到 1

### `arxiv_fetcher.py`
- PDF 质量预检：字符熵 + 英文词比例 + 段落数
- 质量不足 → 跳过 LLM 提取，标记手动审核
- 连续 3 次空结构化数据 → 该查询降级为 metadata-only

### `github_fetcher.py`
- 按 repo 追踪变更频率
- 4 周无新内容 → 降频到月检
- 高活跃 repo → 日检
- trending `since_days` 根据上次 yield 自适应调整

---

## 知识图谱增量推理

### 当前问题

`build_graph.py` 每次都全量重建，推理每个页面调一次 LLM，上下文窗口包含全部页面 ID。

### 改进方案

**1. 优先排序推理预算：**
```
优先级: hub 节点 (degree > μ+2σ) > 桥接节点 (betweenness 高) > 新页面 > 其他
推理预算: 每次运行最多推理 20 个页面
```

**2. 上下文窗口裁剪：**
```
当前: 推理 prompt 包含全部页面 ID (不随规模扩展)
改为: 推理 prompt 只包含 top-30 最相关页面（按现有边接近度排序）
```

**3. 增量 diff：**
```
--diff 标志: 只输出相比上次 build 变化的节点和边
实现: 比较新旧 graph.json → 输出 added_nodes / removed_nodes / added_edges / removed_edges
```

---

## API 缓存与自适应

### `api_server.py`

| 当前 | 改进 |
|------|------|
| 每次 `/api/pages/...` 读取磁盘 | LRU 内存缓存 + 写入时失效 |
| FTS5 重建手动触发 | 新文件摄入后自动触发 |
| 速率限制 60 req/min 硬编码 | 基于实际 429 率自适应调整 |
| 无慢端点检测 | 请求耗时分布追踪 + p95 监控 |

### `tools/shared/wiki.py`

| 当前 | 改进 |
|------|------|
| 5s TTL 全缓存 | 写入时即时失效对应条目 |
| 每次都全量扫描 wiki/ | 稳定期 TTL 延长到 60s，频繁写入期缩短到 1s |
| 全局失效 | 精确失效：只清除被修改路径的缓存 |

---

## 前端离线与智能预取

### `wikiStore.ts`

| 当前 | 改进 |
|------|------|
| 只缓存 graph 数据 | 增加页面内容缓存 `Map<slug, {content, fetchedAt}>` |
| 无预加载 | 当前页面的 wikilinks → 后台预加载 top 5 |
| API 宕机 → 空白页 | 离线模式：全缓存渲染完整 UI |
| 无搜索缓存 | FTS 结果按查询 hash 缓存 2 分钟 |
| 全局退避 | 按端点独立健康模型 |

### `agentKitService.ts`

| 当前 | 改进 |
|------|------|
| 300s 硬编码超时 | 基于上次生成耗时 × 1.5 动态超时 |
| 无防重复提交 | 生成进行中时禁用按钮 + 显示耗时 |
| 无下载进度 | fetch-with-progress 模式 |

### `apiUtils.ts`

| 当前 | 改进 |
|------|------|
| 通用错误消息 | HTTP 状态码语义分类：auth-failure / not-found / server-error / rate-limited |
| 各组件自行处理 | 分类后前端渲染针对性恢复 UI |

---

## Skill/MCP 自优化

### `skill_engine.py`

- 追踪每个 skill 的使用频率和最后使用时间
- 连续 30 天未使用的 skill → 自动禁用（可手动恢复）
- 高频触发模式 → 建议优化 skill 的 `config.json` 触发词

### `mcp_manager.py`

- 追踪服务器健康状态（连续启动失败次数）
- 连续 3 次启动失败 → 自动禁用 + 警告
- 内存使用趋势追踪（psutil 数据持久化到 registry）

### `reflect.py`

- 加入 scheduler 每周计划
- MEMORY.md 中超过 90 天未被引用的学习 → 标记 `[ARCHIVED]`
- 高置信度内容模式 → 自动建议写入 `config/ingest_templates.yaml`

---

## 共享基础设施优化

### `tools/shared/llm.py`

| 功能 | 说明 |
|------|------|
| 错误分类 | 瞬时错误 (429/5xx/ConnectionError) vs 永久错误 (401/403/400) |
| 自适应重试 | 瞬时: 最多 5 次 + 指数退避 + jitter；永久: 0 次 |
| 断路器 | 模块级：连续 N 次失败 → 冷却期内所有调用 `LLMUnavailableError` 快速失败 |
| 预算警告 | 累计 token 超过 80% 日预算 → 日志警告 + 可选切换便宜模型 |

### `tools/shared/wiki.py`

- 写入时即时失效缓存（而非等 5s TTL）
- 自适应 TTL：稳定期 60s / 频繁写入期 1s
- page 级别精确失效（只清除被修改路径）

---

## 代码一致性审计

### 已知不一致

| 工具 | 内联实现 | 应使用 |
|------|----------|--------|
| `health.py` | `extract_wikilinks` 内联 | `tools/shared/wiki.py` |
| `lint.py` | wikilink 解析正则 | `tools/shared/wiki.py` |
| `build_graph.py` | frontmatter 解析 | `tools/shared/wiki.py` |
| `mcp_server.py` | `_read_page` / `_list_pages` | `tools/shared/wiki.py` |
| `skill_engine.py` | `_collect_context` 文件扫描 | `tools/search_engine.py` FTS5 (已修复) |

### 审计原则
- 强制 import `tools/shared/` 而非内联 fallback
- 所有文件读写经过 `wiki.py` 的 `read_file`/`write_file`（含原子写入、路径校验）
- 所有 LLM 调用经过 `llm.py`（含重试、断路器、预算追踪）

---

## 实现优先级路线图

### 第一批：省钱 + 防静默故障（P0）

| 项目 | 文件 | 工作量 |
|------|------|--------|
| 调度器自适应 + 指标追踪 | `scheduler.py` | 小 |
| 搜索查询分析 + 零结果反馈 | `search_engine.py` + `api_server.py` | 中 |
| LLM 提取成本路由 + 内容缓存 | `llm_extractor.py` | 中 |
| 共享 LLM 断路器 + 预算追踪 | `tools/shared/llm.py` | 小 |

### 第二批：闭环自动化（P1）

| 项目 | 文件 | 工作量 |
|------|------|--------|
| `self_optimize.py` 编排器 | `tools/self_optimize.py` (新建) | 中 |
| lint → heal 自动桥接 | `lint.py` + `heal.py` | 小 |
| 域名提取策略学习 | `web_fetcher.py` + `_common.py` | 中 |
| 知识图谱增量推理 | `build_graph.py` | 大 |
| API 页面缓存 + 自动 FTS5 | `api_server.py` | 中 |
| 页面质量评分系统 | `wiki.py` + 新建评分模块 | 中 |

### 第三批：抓取器智能升级（P1-P2）

| 项目 | 文件 | 工作量 |
|------|------|--------|
| RSS/arXiv/GitHub 按域名/feed 自适应 | 各 fetcher | 中 |
| 跨抓取器协调层 | `_common.py` | 中 |
| PDF 质量预检 | `arxiv_fetcher.py` | 小 |
| 断路器基础设施 | `tools/shared/` (新建) | 中 |

### 第四批：前端体验飞跃（P2）

| 项目 | 文件 | 工作量 |
|------|------|--------|
| 页面内容缓存 + wikilinks 预加载 | `wikiStore.ts` | 中 |
| 离线模式 | `wikiStore.ts` + `dataService.ts` | 大 |
| FTS 搜索缓存 | `wikiStore.ts` | 小 |
| HTTP 错误语义分类 | `apiUtils.ts` | 小 |
| Skill 使用统计 + 自动禁用 | `skill_engine.py` | 小 |
| Reflect 自动模板建议 | `reflect.py` | 中 |

### 第五批：长期稳定（P3）

| 项目 | 文件 | 工作量 |
|------|------|--------|
| 跨工具代码一致性审计 | 全部 tools/ | 中 |
| 导出依赖感知增量更新 | `export_agent_kit.py` | 中 |
| 自适应阈值框架 | `tools/shared/` (新建) | 大 |
| 跨工具共享状态 schema 统一 | `state/` + `_common.py` | 大 |

---

## 预期效果

| 维度 | 当前 | 目标 |
|------|------|------|
| **维护人工介入** | 每周多次手动运行 lint/heal/reflect | 全自动，仅异常时通知 |
| **LLM 调用成本** | 每页都调最贵模型，无缓存 | 简单页面用便宜模型，内容缓存命中率 >40% |
| **搜索质量** | 零结果静默，嵌入过期 | 零结果自动建议，增量重建嵌入 |
| **抓取效率** | 死源反复重试，静态频率 | 自动降频死源，提升活跃源频率 |
| **前端体验** | 离线时空白页，每次导航都请求 | 离线可用，wikilinks 即时加载 |
| **故障恢复** | 单个 LLM 故障 → 所有调用方各自重试 | 断路器快速失败，冷却后自动恢复 |

---

## 本次已修复的先决条件

在进行上述改进之前，以下 skill/MCP 模块的基础 bug 已在 2026-05-10 修复：

1. `MCPManager.__init__` 从不调用 `_register_builtins()` → 已添加调用
2. `skill_router.py` 硬编码 Windows 绝对路径 → 已改为 `Path.home()`
3. `agent-tools/server.py` 路径遍历漏洞 → 已添加 `is_relative_to` 校验
4. `skill_engine.py` `_register_builtins` 全覆盖已有技能 → 已改为 merge 逻辑
5. `_collect_context` 未使用 FTS5 索引 → 已优先使用 `WikiSearchEngine`
6. `mcp_generator.py` 生成的函数名可能含非法字符 → 已全面清理
7. `_escape_py_string` 转义不充分 → 已增加 `\r` `\t` `\x00`
8. `_install_local` Unix 平台用 `cp` 命令 → 已统一 `shutil.copytree`
9. `call_tool` 空桩无说明 → 已添加 TODO 注释
10. agent-tools 输出截取丢失错误信息 → 已改为取头部
11. YAML 只解析 `|` 块标量 → 已支持所有变体
12. 内置 agent-tools 工具列表与实际不符 → 已修正
13. pip 包安装后 `sys.path` 不可见 → 已生成 `_bootstrap.py`
