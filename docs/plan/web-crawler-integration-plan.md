# 通用网页爬虫集成方案 (Web Crawler Integration Plan)

> **状态**: 调研完成，待开发  
> **更新日期**: 2026-05-06  
> **关联项目**: `tools/fetchers/`, `tools/scheduler.py`, `tools/ingest.py`, `tools/batch_compiler.py`

---

## 1. 背景与需求

### 1.1 现状

当前项目已拥有三类定向数据抓取能力：

| 模块 | 路径 | 数据源 | 技术栈 |
|---|---|---|---|
| RSS Fetcher | `tools/fetchers/rss_fetcher.py` | RSS/Atom Feeds | `urllib` + `xml.etree` (stdlib) |
| arXiv Fetcher | `tools/fetchers/arxiv_fetcher.py` | arXiv API | `urllib` + `xml.etree` (stdlib) |
| GitHub Fetcher | `tools/fetchers/github_fetcher.py` | GitHub REST API | `urllib` + `json` (stdlib) |
| 调度器 | `tools/scheduler.py` | 编排上述任务 | `schedule` (可选依赖) |

所有现有 fetcher 遵循统一设计约束：
- **零外部 HTTP 依赖**：使用 `urllib.request` 而非 `requests`
- **状态去重**：通过 `raw-inbox/state.json` 追踪已处理 URL
- **YAML 配置**：通过 `config/*.yaml` 定义源列表
- **Markdown 输出**：抓取结果保存为带 YAML frontmatter 的 `.md` 文件到 `raw-inbox/fetched/<source_type>/`
- **独立脚本**：每个 fetcher 可单独执行，也可被 `scheduler.py` 调用
- **下游衔接**：输出文件经 `batch_compiler.py` 编组后由 `batch_ingest.py` 摄入 wiki

### 1.2 缺失能力

现有 fetchers 均针对**结构化 API 或协议**（RSS、arXiv Atom、GitHub REST）。项目缺少对**任意网页 URL** 的通用抓取能力：

- 无法抓取博客文章、技术文档、新闻页面等普通网页
- 用户只能手动复制粘贴网页内容到 `raw/` 目录
- 知识库的自动扩展受限于数据源类型

### 1.3 目标

引入一个**通用网页爬虫（Web Fetcher）**，使其在架构风格、依赖策略、输出格式上与现有 fetchers **完全对齐**，同时提供业界领先的正文提取准确率。

**核心约束**：
- 新增文件 ≤ 2 个，遵循现有 `tools/fetchers/` 目录结构
- 复用现有 `state.json` 去重、`batch_compiler.py` 编组、`scheduler.py` 调度
- 新增外部依赖 ≤ 1 个（正文提取库）
- 零破坏性变更：不修改任何现有 fetcher 的行为

---

## 2. 候选技术方案

### 2.1 第一层筛选：API 服务类（排除）

依赖外部商业服务（Firecrawl、Jina Reader 等），需 API Key，违背项目"本地优先、零外部依赖"原则。排除。

### 2.2 第二层筛选：Python 库对比

| 维度 | Trafilatura | readability-lxml | newspaper3k | BeautifulSoup + 手写 | markitdown (已有) |
|---|---|---|---|---|---|
| **正文提取准确率** | ★★★★★ (Jina 评测 96.2%) | ★★★★ | ★★★ | ★★ (取决于实现) | ★★★ (通用转换) |
| **反爬绕过** | 内置 robots.txt 遵守、自动重试、浏览器指纹可选 | 无 | 无 | 需手动实现 | 无 |
| **元数据提取** | 标题/日期/作者/站点名/描述 | 无 | 标题/作者 | 无 | 无 |
| **多语言** | 30+ 语言，CJK 支持良好 | 主要英文 | 主要英文 | 取决于实现 | 依赖底层引擎 |
| **JavaScript 渲染** | ✅ 可选（基于浏览器引擎） | ❌ | ❌ | ❌ | ❌ |
| **零配置可用性** | `extract(html)` 一行调用 | 需要手动调用 | 需要初始化 | 大量手写代码 | N/A |
| **维护状态** | 活跃 (GitHub 13k+ ⭐) | 维护中但更新慢 | 已停止维护 (被 `newspaper4k` 接手) | N/A | 活跃 (微软) |
| **额外依赖** | `trafilatura` (含 lxml) | `readability-lxml` + `lxml` | `newspaper3k` + `nltk` + 大量传递依赖 | `beautifulsoup4` + `lxml` | 已在项目中 |
| **依赖体积** | 中等 (~5MB) | 小 (~1MB) | 大 (~50MB 含 nltk) | 小 (~1MB) | 0 (已有) |

### 2.3 决策：Trafilatura + markitdown 双引擎

**主引擎：Trafilatura**
- 业界最高正文提取准确率
- 内置元数据提取（标题、日期、作者），减少手写解析
- 内置 robots.txt 遵守，合规性开箱即用
- CJK 支持良好，匹配项目国际化需求

**备用引擎：markitdown（已有依赖）**
- 项目已依赖 `markitdown[all]`（`pyproject.toml` 标注为核心依赖）
- `markitdown` 可直接将 HTML 转换为 Markdown，无需额外依赖
- 当 Trafilatura 提取失败（如 SPA 页面、特殊 HTML 结构）时作为 fallback
- 不增加任何新依赖

> **为什么不用 markitdown 作为唯一引擎？**
> markitdown 是通用格式转换器，不做正文提取——它会保留导航栏、页脚、侧边栏等非正文内容。Trafilatura 专门解决"从网页中只提取正文"这个问题。

---

## 3. 架构设计

### 3.1 设计原则

**遵循现有模式**：Web Fetcher 是 `tools/fetchers/` 下的第 4 个 fetcher，不是独立子系统。它遵循与 `rss_fetcher.py`、`arxiv_fetcher.py`、`github_fetcher.py` 完全相同的架构模式：

```
config/web_sources.yaml  ← URL 列表配置（与 rss_sources.yaml 同级）
        ↓
tools/fetchers/web_fetcher.py  ← 爬取 + 正文提取 + 写入 .md
        ↓
raw-inbox/fetched/web/*.md  ← 输出目录（与 rss/、arxiv/、github/ 同级）
        ↓
batch_compiler.py → batch_ingest.py → wiki/  ← 复用现有下游管线
```

### 3.2 核心流程

```
web_sources.yaml
      │
      ▼
┌─────────────────────────────┐
│     web_fetcher.py          │
│                             │
│  1. 加载 config + state     │
│  2. 遍历 URL 列表           │
│  3. 去重检查 (state.json)   │
│  4. HTTP GET (urllib)       │
│  5. 正文提取                │
│     ├─ Trafilatura (主)     │
│     └─ markitdown (备用)    │
│  6. 元数据组装              │
│  7. 写入 .md + 更新 state   │
└─────────────┬───────────────┘
              │
              ▼
    raw-inbox/fetched/web/*.md
              │
              ▼
    batch_compiler.py → batch_ingest.py → wiki/
```

### 3.3 配置文件设计

```yaml
# config/web_sources.yaml
# Run: python tools/fetchers/web_fetcher.py --config config/web_sources.yaml

urls:
  - url: "https://lilianweng.github.io/posts/2023-06-23-agent/"
    name: "LLM Powered Autonomous Agents"
    tags: [agents, llm]

  - url: "https://jalammar.github.io/illustrated-transformer/"
    name: "The Illustrated Transformer"
    tags: [transformer, attention]

  - url: "https://www.anthropic.com/research/building-effective-agents"
    name: "Building Effective Agents"
    tags: [agents, anthropic]

# 全局设置
settings:
  timeout: 30                # 单页超时 (秒)
  user_agent: "llm-wiki-agent/1.0"
  respect_robots_txt: true   # 遵守 robots.txt
  fallback_to_markitdown: true  # Trafilatura 失败时用 markitdown 兜底
```

### 3.4 输出文件格式

与现有 fetcher 完全一致的 frontmatter 格式：

```markdown
---
title: "The Illustrated Transformer"
source_url: "https://jalammar.github.io/illustrated-transformer/"
fetched_at: "2026-05-06T12:00:00+00:00"
source_type: "web"
name: "The Illustrated Transformer"
tags: "transformer, attention"
---

## Summary

[正文内容...]
```

### 3.5 文件结构

仅新增 2 个文件，零修改现有文件：

```
新增文件：
  tools/fetchers/web_fetcher.py    # 爬虫主逻辑 (~200 行)
  config/web_sources.yaml          # URL 配置

修改文件（仅新增一行 schedule 调用）：
  tools/scheduler.py               # 添加 web_fetcher 调度

依赖变更：
  requirements.txt                 # 添加 trafilatura
  pyproject.toml                   # 添加 trafilatura
```

### 3.6 模块内部结构

```python
# tools/fetchers/web_fetcher.py 内部函数划分

# ── 状态管理 ── (复用现有 state.json 模式)
_load_state() -> dict
_save_state(state) -> None

# ── HTTP 请求 ── (复用 urllib 模式)
_fetch_html(url, timeout, user_agent) -> str | None

# ── 正文提取 ──
_extract_with_trafilatura(html, url) -> dict | None
_extract_with_markitdown(html) -> str | None   # 备用
_extract_content(html, url, fallback) -> dict  # 主入口，自动降级

# ── 输出 ──
_write_entry(url, name, tags, extracted) -> Path | None

# ── 主流程 ──
run(config_path, timeout) -> int

# ── CLI ──
main()  # argparse 入口
```

### 3.7 调度器集成

`scheduler.py` 仅需新增一个函数和一行调度：

```python
def fetch_web() -> None:
    _run([PYTHON, "tools/fetchers/web_fetcher.py", "--config", "config/web_sources.yaml"])

# 在现有调度列表中追加：
schedule.every().day.at("08:45").do(fetch_web)  # 在 arXiv 之后
```

---

## 4. 依赖与集成

### 4.1 新增依赖

| 包 | 版本约束 | 用途 | 体积 | 替代方案 |
|---|---|---|---|---|
| `trafilatura` | `>=1.12.0` | HTML 正文提取 + 元数据 | ~5MB | markitdown (已有，作为 fallback) |

### 4.2 已有依赖复用

| 已有依赖 | 复用点 |
|---|---|
| `markitdown[all]` | HTML→Markdown 备用转换 |
| `schedule` | 调度器集成 |
| `urllib` (stdlib) | HTTP 请求 |
| `pyyaml` | 配置文件解析 |

### 4.3 下游管线衔接（零改动）

```
web_fetcher.py
    ↓ 输出到
raw-inbox/fetched/web/*.md    ← batch_compiler.py 自动发现此目录下的 .md 文件
    ↓ batch_compiler.py 按 source_type 分组编组
raw-inbox/batches/batch-web-2026-W19.md
    ↓ batch_ingest.py 调用 ingest.py
wiki/sources/*.md
```

`batch_compiler.py` 的 `run()` 函数通过 `FETCHED_DIR.iterdir()` 自动扫描所有子目录，无需任何修改即可识别 `web/` 子目录。

---

## 5. 实施计划

### 5.1 Phase 1：基础可用 (Day 1–2)

**目标**：跑通最小闭环，抓取单个网页并输出到 wiki。

| 任务 | 描述 | 产出 |
|---|---|---|
| 1.1 | 创建 `config/web_sources.yaml`（3–5 个示例 URL） | 配置文件 |
| 1.2 | 实现 `tools/fetchers/web_fetcher.py` 核心逻辑 | ~200 行 Python |
| 1.3 | 安装依赖 + 本地测试（`pip install trafilatura`） | 验证端到端 |
| 1.4 | 更新 `requirements.txt` 和 `pyproject.toml` | 依赖声明 |

**验收标准**：
```bash
# 1. 单独运行
python tools/fetchers/web_fetcher.py --config config/web_sources.yaml
# 预期：raw-inbox/fetched/web/ 下生成 .md 文件

# 2. 端到端管线
python tools/batch_compiler.py --window daily
python tools/batch_ingest.py --dry-run
# 预期：编组成功，dry-run 显示正确的 batch 路径
```

### 5.2 Phase 2：可靠性加固 (Day 3)

**目标**：错误处理、备用引擎、重试机制。

| 任务 | 描述 |
|---|---|
| 2.1 | 实现 Trafilatura → markitdown 自动降级 |
| 2.2 | 添加超时控制、User-Agent、robots.txt 遵守（Trafilatura 内置） |
| 2.3 | 添加请求间隔（默认 1 秒），避免对目标站点造成压力 |
| 2.4 | 异常处理：网络超时、编码错误、空内容检测 |

### 5.3 Phase 3：调度集成 (Day 4)

**目标**：接入现有自动化管线。

| 任务 | 描述 |
|---|---|
| 3.1 | 修改 `scheduler.py`：添加 `fetch_web()` 函数 + 调度行 |
| 3.2 | 端到端测试：scheduler 触发 → web_fetcher → batch_compiler → batch_ingest |
| 3.3 | 更新项目文档（`CLAUDE.md`、`AGENTS.md` 的 Tools Reference 表） |

### 5.4 Phase 4：监控与优化 (Day 5–6)

**目标**：可观测性和体验优化。

| 任务 | 描述 |
|---|---|
| 4.1 | 输出抓取统计摘要（成功/失败/跳过数量） |
| 4.2 | 验证 wiki 内容质量（对比 Trafilatura vs markitdown 输出） |
| 4.3 | 可选：添加 `--max-urls` CLI 参数限制单次抓取数量 |
| 4.4 | 可选：支持 URL 列表从文件读取（`--urls-file`） |

---

## 6. 风险与缓解

| 风险 | 概率 | 影响 | 缓解策略 |
|---|---|---|---|
| **目标站点反爬** | 中 | 部分 URL 抓取失败 | Trafilatura 内置 robots.txt 遵守；添加请求间隔（1s）；设置合理 User-Agent；对于明确禁止爬取的站点，记录日志并跳过 |
| **Trafilatura 提取质量不佳** | 低 | 正文混入噪音 | 双引擎降级：Trafilatura 失败时自动切换 markitdown；人工抽检输出质量 |
| **页面需要 JavaScript 渲染** | 中 | SPA 页面提取为空 | 当前阶段不支持 JS 渲染（避免引入 Playwright 等重量级依赖）；Trafilatura 的 `include_comments=False` + `favor_precision=True` 配置优先保证准确性；对于 SPA 页面，建议用户使用 arXiv/RSS 等结构化数据源替代 |
| **依赖冲突** | 低 | trafilatura 与现有依赖不兼容 | trafilatura 依赖 lxml，与 markitdown 共享，实际冲突概率极低；`pip install` 时验证依赖树 |
| **state.json 并发写入** | 低 | 去重状态损坏 | 现有 fetcher 均为串行执行（scheduler 顺序调用），不存在并发问题；若未来需要并行，再引入文件锁 |

---

## 7. 成功指标

### 7.1 功能指标

| 指标 | 目标值 | 测量方法 |
|---|---|---|
| 正文提取准确率 | ≥ 90%（人工抽检 20 个网页） | 对比原文与提取内容 |
| 抓取成功率 | ≥ 85%（排除 robots.txt 禁止的站点） | 统计 `run()` 输出 |
| 端到端管线成功率 | 100% | web_fetcher → batch_compiler → batch_ingest 全链路 |
| wiki 内容质量 | 与手动粘贴无明显差异 | 对比 wiki lint 报告 |

### 7.2 工程指标

| 指标 | 目标值 |
|---|---|
| 新增文件数 | ≤ 2 |
| 修改现有文件数 | ≤ 1（scheduler.py） |
| 新增外部依赖数 | 1（trafilatura） |
| 新增代码行数 | ≤ 250 |
| 现有测试全部通过 | ✅ (health.py 零问题) |

---

## 8. 未来扩展（不在本次范围内）

以下方向在基础版本稳定后可考虑，按优先级排序：

| 方向 | 优先级 | 说明 |
|---|---|---|
| **Sitemap 自动发现** | P2 | 从 `sitemap.xml` 自动提取 URL 列表，减少手动配置 |
| **RSS → Web 联动** | P2 | RSS Fetcher 发现文章链接后自动触发 Web Fetcher 抓取全文 |
| **增量更新检测** | P3 | 通过 ETag/Last-Modified 头检测页面变更，只更新有变化的页面 |
| **JavaScript 渲染** | P3 | 集成 Playwright/undetected-chromedriver 处理 SPA 页面（重量级，慎选） |
| **多页面爬取** | P3 | 从种子 URL 出发，按规则爬取关联页面（需深度限制和去重） |

---

## 9. 附录

### A. 与现有 Fetcher 模式对比

| 维度 | RSS Fetcher | arXiv Fetcher | GitHub Fetcher | **Web Fetcher (新)** |
|---|---|---|---|---|
| 配置文件 | `config/rss_sources.yaml` | `config/arxiv_sources.yaml` | `config/github_sources.yaml` | `config/web_sources.yaml` |
| 输出目录 | `raw-inbox/fetched/rss/` | `raw-inbox/fetched/arxiv/` | `raw-inbox/fetched/github/` | `raw-inbox/fetched/web/` |
| 去重机制 | `state.json` URL 去重 | `state.json` URL 去重 | `state.json` URL 去重 | `state.json` URL 去重 |
| HTTP 客户端 | `urllib.request` | `urllib.request` | `urllib.request` | `urllib.request` |
| 外部依赖 | 无 | 无 | 无 | `trafilatura` |
| CLI 入口 | `--config` | `--config` | `--config` | `--config` |
| 调度器集成 | `fetch_rss()` | `fetch_arxiv()` | `fetch_github()` | `fetch_web()` |

### B. Trafilatura 核心 API 示例

```python
import trafilatura

# 下载页面（内置 robots.txt 检查、重试、超时）
downloaded = trafilatura.fetch_url(url)

# 提取正文（自动检测语言、去除噪音）
text = trafilatura.extract(
    downloaded,
    include_comments=False,
    include_tables=True,
    favor_precision=True,      # 优先准确性而非召回率
    deduplicate=True,          # 去除重复段落
)

# 提取元数据
metadata = trafilatura.extract_metadata(downloaded)
# metadata.title, metadata.date, metadata.author, metadata.sitename
```

### C. 快速启动命令

```bash
# 安装依赖
pip install trafilatura

# 创建配置
# (复制上方 3.3 节的 YAML 到 config/web_sources.yaml)

# 测试运行
python tools/fetchers/web_fetcher.py --config config/web_sources.yaml

# 检查输出
ls raw-inbox/fetched/web/

# 端到端管线测试
python tools/batch_compiler.py --window daily --dry-run
python tools/batch_ingest.py --dry-run
```
