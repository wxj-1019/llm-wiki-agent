# LLM 智能爬虫优化方案

> 创建日期: 2026-05-09 | 状态: 待实施

---

## 一、当前爬虫诊断

### 1.1 现有 Fetcher 分析

经过对 `tools/fetchers/` 下三个爬虫及实际采集数据的审查，诊断如下：

#### RSS Fetcher (`rss_fetcher.py`)

- **核心问题**: `rss_fetcher.py:94` 只提取 `<description>` 或 `<content:encoded>` 标签
- **影响**: 绝大多数 RSS 源只提供 1-2 句摘要，从未跟随链接抓取原文
- **结果**: wiki 里只有标题+摘要碎片，没有实质内容

#### arXiv Fetcher (`arxiv_fetcher.py`)

- **核心问题**: `arxiv_fetcher.py:94-107` 只获取标题、作者、分类和摘要
- **影响**: 从不下载 PDF 全文（项目中已有 `pdf2md.py` 但未被调用）
- **结果**: wiki 里论文只有摘要，无法深入理解研究内容

#### GitHub Fetcher (`github_fetcher.py`)

- **核心问题**: `github_fetcher.py:127-148` 从 API 获取 README（base64 解码）
- **影响**: README 被 API 响应截断，无代码结构分析，Release notes 不完整
- **结果**: 仓库信息流于表面，缺乏深度技术理解

#### Web Fetcher (trafilatura)

- **核心问题**: 纯规则提取，无 JS 渲染，无 LLM 理解
- **典型失败案例**: `2026-05-06-新浪新闻.md` — 从新浪新闻首页只提取到了导航链接列表，完全不是新闻内容
- **结果**: trafilatura 对中文站点、JS 渲染页面、复杂布局效果极差

### 1.2 共同缺陷

| 问题 | 影响 |
|---|---|
| 不支持 JS 渲染 | 现代 SPA 站点（React/Vue）返回空壳 |
| 无 LLM 内容理解 | 不会提取关键信息、实体、关系 |
| 无智能爬取 | 不会翻页、跟随链接、深度遍历 |
| 提取器过于简单 | trafilatura/readability 对非英文站点效果极差 |
| 无结构化抽取 | 不会利用 schema.org、JSON-LD |
| RSS 只抓摘要 | 从来不会跟随链接抓取全文 |

### 1.3 数据验证

```
raw-inbox/fetched/ 目录结构:
├── web/           (仅 3 个文件，其中 2 个是相同页面的重复)
├── rss/           (不存在 — RSS Fetcher 从未成功运行)
├── arxiv/         (不存在 — arXiv Fetcher 从未成功运行)
└── github/        (不存在 — GitHub Fetcher 从未成功运行)

state.json: 仅 1 个已处理 URL
```

---

## 二、GitHub 主流 LLM 爬虫方案调研

| 项目 | Stars | 核心思路 | 特点 |
|---|---|---|---|
| **Crawl4AI** ([unclecode/crawl4ai](https://github.com/unclecode/crawl4ai)) | ~20k | 异步 Python + 浏览器渲染 + LLM 提取 | **原生支持 litellm**，可复用现有技术栈 |
| **Firecrawl** ([mendableai/firecrawl](https://github.com/mendableai/firecrawl)) | ~25k | 全栈爬虫平台、LLM 内容清洗 | 最成熟，可自托管，文档完善 |
| **Jina Reader** ([jina-ai/reader](https://github.com/jina-ai/reader)) | ~12k | URL 前缀 → Markdown，零配置 | 依赖外部服务，简单但不可控 |
| **ScrapeGraph AI** ([ScrapeGraphAI/scrapegraph-ai](https://github.com/ScrapeGraphAI/scrapegraph-ai)) | ~15k | 图编排 + LLM 多步爬取流水线 | 复杂多页爬取场景适用 |
| **GPT Crawler** ([BuilderIO/gpt-crawler](https://github.com/BuilderIO/gpt-crawler)) | ~19k | 整站爬取 → LLM 知识库 | 站点镜像场景适用 |
| **Reader LLM** ([jina-ai/reader](https://github.com/jina-ai/reader)) | ~5k | 1.5B 本地模型做 HTML → MD | 实验性质，本地离线运行 |
| **markitdown** ([microsoft/markitdown](https://github.com/microsoft/markitdown)) | ~40k | 20+ 格式 → MD 转换 | **已是项目依赖** — 文件转换继续用 |
| **Trafilatura** ([adbar/trafilatura](https://github.com/adbar/trafilatura)) | ~4k | 纯规则提取（当前方案） | 无 LLM，对非英文站点效果差 |

### 推荐: Crawl4AI

**Crawl4AI 是当前最适合本项目的方案**，原因：

1. **原生支持 litellm** — 与项目现有 LLM 网关无缝集成:
   ```python
   strategy = LLMExtractionStrategy(
       provider="litellm/claude-sonnet-4-6",
       extraction_type="markdown",
       instruction="提取正文，排除导航和广告"
   )
   ```

2. **异步 Python** — 可以并发抓取多个源，与项目架构一致

3. **浏览器内置** — 解决 JS 渲染这个最大痛点

4. **结构化提取** — 可以按 schema 提取实体，直接映射为 `[[wikilinks]]`

5. **本地 LLM 支持** — 支持 Ollama，零 API 成本备选方案

---

## 三、推荐架构：三层混合模型

```
┌──────────────────────────────────────────────────────────────┐
│                   LLM-Wiki Crawler v2                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: 抓取层 (Fetch)                                     │
│  ├── Playwright          → JS 渲染页面                        │
│  ├── httpx / aiohttp     → API / 静态页面                     │
│  └── feedparser          → RSS/Atom (替换手写 XML 解析)       │
│                                                              │
│  Layer 2: 提取层 (Extract)                                   │
│  ├── trafilatura         → 快速预提取（免费、离线）            │
│  ├── schema.org/JSON-LD  → 结构化数据优先提取                  │
│  └── markitdown          → PDF/DOCX 等文件转换                 │
│                                                              │
│  Layer 3: LLM 理解层 (Intelligence) ★核心★                    │
│  ├── 内容质量评分        → 低质内容自动过滤                    │
│  ├── 正文精准提取        → 去导航/广告/推荐                    │
│  ├── 实体识别            → 自动生成 [[wikilinks]]              │
│  ├── 摘要生成            → 替代不完整的 RSS 片段               │
│  └── 结构化抽取          → 表格/数据/列表                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 核心设计原则

1. **LLM 做"理解层"而非"替代层"** — 爬虫负责抓取+渲染，LLM 负责提取+结构化+质量判断
2. **分级处理控制成本** — trafilatura 预提取 → 质量评分 → 低质才送 LLM
3. **复用现有技术栈** — litellm、markitdown 继续用，只加必要的（Playwright、feedparser）
4. **抓取与理解解耦** — 抓取结果先落盘为 raw markdown，LLM 理解异步进行

---

## 四、分阶段实施计划

### Phase 1: RSS 全文抓取（优先级最高）

**目标**: RSS 摘要 → 完整文章 Markdown

| 子任务 | 说明 |
|---|---|
| 1.1 新建 `tools/fetchers/llm_scraper.py` | LLM 驱动的智能内容提取器核心模块 |
| 1.2 改造 `rss_fetcher.py` | 提取 RSS 链接后，跟随链接调用 LLM 爬虫抓取全文 |
| 1.3 新增 `config/scraper_config.yaml` | LLM 爬虫配置（模型选择、质量阈值、提取策略） |
| 1.4 引入 `feedparser` | 替换手写 XML 解析，支持更多 RSS/Atom 变体 |

**预期效果**: RSS 源内容从 50-200 字摘要提升为完整文章

### Phase 2: arXiv 全文转换

**目标**: 论文摘要 → 完整论文全文

| 子任务 | 说明 |
|---|---|
| 2.1 改造 `arxiv_fetcher.py` | 获取论文元数据后自动下载 PDF |
| 2.2 集成 `tools/pdf2md.py` | 自动调用 markitdown 将 PDF 转为 Markdown |
| 2.3 新增 LLM 论文结构化 | 提取 "方法/实验/结论" 等结构化章节 |

**预期效果**: 每篇论文从 200 字摘要变为 3000-10000 字全文

### Phase 3: Web JS 渲染 + LLM 提取

**目标**: trafilatura 失败案例 → 高质量提取

| 子任务 | 说明 |
|---|---|
| 3.1 安装 Playwright | `pip install playwright && playwright install chromium` |
| 3.2 新建 `tools/fetchers/web_fetcher.py` | 整合 Playwright + LLM 提取的通用网页爬虫 |
| 3.3 LLM 质量评分 | 自动检测纯导航页、错误页、反爬页并过滤 |
| 3.4 新增中文站点优化 | LLM prompt 专门优化中文内容提取 |

**预期效果**: JS 渲染页面可正常抓取，中文站点提取质量大幅提升

### Phase 4: 集成 Crawl4AI（中期）

**目标**: 用成熟方案替换自研 LLM 提取逻辑

| 子任务 | 说明 |
|---|---|
| 4.1 `pip install crawl4ai` | 安装 Crawl4AI |
| 4.2 配置 litellm provider | 复用项目现有 litellm 配置 |
| 4.3 结构化实体抽取 | 自动识别实体并生成 `[[wikilinks]]` |
| 4.4 替换自研 `llm_scraper.py` | 减少维护代码量 |

**预期效果**: 生产级稳定性，更少的自研代码维护负担

### Phase 5: 智能管道增强（长期）

| 子任务 | 说明 |
|---|---|
| 5.1 智能去重 | 基于语义相似度（而非仅 URL）去重 |
| 5.2 内容优先级排序 | LLM 判断内容重要性，优先处理高价值内容 |
| 5.3 自动化爬取策略 | 根据站点质量自动调整抓取频率和深度 |
| 5.4 反爬对抗 | LLM 检测验证码/拦截页面，自动切换策略 |

---

## 五、LLM 智能爬虫核心模块设计

### 5.1 `llm_scraper.py` 架构

```python
class LLMWebScraper:
    """使用 LLM 做智能内容提取和质量增强"""

    async def scrape(self, url: str) -> StructuredPage:
        # 1. 原始抓取（Playwright 渲染 + trafilatura 预提取）
        raw_html = await self._fetch_with_browser(url)
        pre_extracted = trafilatura.extract(raw_html)

        # 2. LLM 质量评估
        quality = await self._llm_quality_check(url, pre_extracted)
        if quality.score < 30:
            return StructuredPage(quality="low", reason=quality.reason)

        # 3. LLM 精准提取（核心）
        clean_content = await self._llm_extract_content(
            raw_html, pre_extracted,
            instruction="提取正文，排除导航、广告、侧边栏、推荐链接"
        )

        # 4. LLM 结构化增强
        entities = await self._llm_extract_entities(clean_content)
        summary = await self._llm_summarize(clean_content)
        wikilinks = self._entities_to_wikilinks(entities)

        return StructuredPage(
            content=clean_content,
            summary=summary,
            entities=entities,
            wikilinks=wikilinks,
            quality=quality
        )
```

### 5.2 数据流

```
URL 输入
  │
  ▼
Playwright 渲染 ─── 获取完整 HTML
  │
  ├── trafilatura 预提取 (免费)
  │     │
  │     ▼
  │   质量评分 > 60? ─── Yes ──→ 直接写入 raw-inbox
  │     │
  │     No
  │     ▼
  └── LLM 精准提取
        │
        ├── 正文清洗
        ├── 结构化抽取
        ├── 实体识别
        └── 摘要生成
              │
              ▼
        写入 raw-inbox/fetched/<source>/
              │
              ▼
        batch_compiler → batch_ingest → wiki/
```

### 5.3 配置设计 (`config/scraper_config.yaml`)

```yaml
# LLM 爬虫配置
scraper:
  # 浏览器设置
  browser:
    enabled: true
    timeout: 30
    wait_for_selector: "article, main, .content, #content"

  # LLM 提取策略
  extraction:
    provider: "litellm"
    model: "claude-haiku-4-5"  # 日常提取用小模型
    deep_model: "claude-sonnet-4-6"  # 复杂页面用大模型
    max_tokens_per_page: 4000

  # 质量阈值
  quality:
    min_score: 30       # 低于此分直接丢弃
    trafilatura_threshold: 60  # 高于此分跳过 LLM，直接用 trafilatura 结果

  # 去重
  dedup:
    url_hash: true
    content_simhash: true
    simhash_threshold: 0.85

  # 速率控制
  rate_limit:
    requests_per_minute: 10
    concurrent_requests: 3
```

---

## 六、成本控制

### 6.1 策略

| 策略 | 实现方式 |
|---|---|
| **分级处理** | trafilatura 免费预提取 → 质量分 > 60 直接入库 → 只有低质才送 LLM |
| **小模型优先** | 简单清洗用 haiku（便宜），复杂理解用 sonnet/opus |
| **内容去重** | URL + content hash + simhash 语义去重 |
| **批量调用** | 攒一批页面再批量调 LLM，减少 API 往返开销 |
| **本地模型备选** | Crawl4AI 支持 Ollama 本地模型，零 API 成本 |
| **内容长度限制** | 单页超过 8000 token 截断，只提取核心正文 |

### 6.2 月成本估算

以每天抓取 50 篇文章、每篇平均 3000 token 计算：

| 模型 | 单价 (每百万 token) | 月成本 |
|---|---|---|
| Claude Haiku 4.5 | ~$1.00 | **$4-6** |
| Claude Sonnet 4.6 | ~$3.00 | **$12-18** |
| 混合策略 (80% Haiku + 20% Sonnet) | — | **$6-10** |
| Ollama 本地模型 | $0 | **$0**（需要 GPU） |

---

## 七、文件变更清单

### 新建文件

| 文件 | 说明 |
|---|---|
| `tools/fetchers/llm_scraper.py` | LLM 智能爬虫核心模块 |
| `tools/fetchers/web_fetcher.py` | 通用网页爬虫（Playwright + LLM） |
| `config/scraper_config.yaml` | 爬虫配置 |

### 修改文件

| 文件 | 变更内容 |
|---|---|
| `tools/fetchers/rss_fetcher.py` | 集成 LLM 爬虫，跟随链接抓取全文 |
| `tools/fetchers/arxiv_fetcher.py` | 集成 PDF 下载 + markitdown 转换 |
| `tools/fetchers/github_fetcher.py` | LLM 增强 README 提取和代码分析 |
| `requirements.txt` / `pyproject.toml` | 新增 `playwright`, `feedparser`, `crawl4ai`（可选） |

---

## 八、风险评估

| 风险 | 概率 | 缓解措施 |
|---|---|---|
| LLM API 调用失败 | 中 | 降级到 trafilatura 纯规则提取 |
| 反爬虫拦截 | 中 | Playwright 模拟真实浏览器 + LLM 检测拦截页 |
| Token 成本超预期 | 低 | 严格的分级处理 + 内容长度限制 + 本地模型备选 |
| 爬取速度过慢 | 中 | 异步并发 + 分批处理 |
| LLM 提取内容幻觉 | 低 | 原文对照校验 + 来源标注 |

---

## 九、参考资料

- [Crawl4AI GitHub](https://github.com/unclecode/crawl4ai)
- [Firecrawl GitHub](https://github.com/mendableai/firecrawl)
- [Jina Reader](https://reader.jina.ai)
- [ScrapeGraph AI GitHub](https://github.com/ScrapeGraphAI/scrapegraph-ai)
- [Microsoft markitdown](https://github.com/microsoft/markitdown)
- [trafilatura](https://github.com/adbar/trafilatura)
