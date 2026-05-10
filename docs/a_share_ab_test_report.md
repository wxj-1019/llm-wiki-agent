# A 股数据源爬虫迭代报告 — Phase 9 最终优化

> 测试日期: 2026-05-10 | 模型: deepseek/deepseek-chat | 成功率: 12/12 (100%) | 平均质量: 75.9/100

---

## 迭代里程碑

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | RSS/Atom 全文提取 | ✅ |
| Phase 2 | arXiv PDF 转换 | ✅ |
| Phase 3 | Playwright JS 渲染 + Scrapling | ✅ |
| Phase 4 | Crawl4AI 适配器（结论：不需要） | ✅ |
| Phase 5 | 智能管道（去重/自适应速率/变更检测） | ✅ |
| Phase 6 | 站点专用 CSS 选择器 | ✅ |
| Phase 7 | DeepSeek LLM 配置 + 全链路验证 | ✅ |
| Phase 8 | LLM 清洗层 + 评分算法优化 + 智能截断 | ✅ |
| Phase 9 | Playwright 站点等待 + 数据源替换 + 选择器扩展 | ✅ |

---

## 12 源最终测试结果

**降级链**: trafilatura (L1) → Scrapling + 站点选择器 (L2) → LLM 清洗 (L2.5) → LLM deep (L3)

| # | 站点 | 引擎 | 质量 | 说明 |
|---|------|------|------|------|
| 1 | 东财-个股新闻 | scrapling(.contentwrap) | **B:76.5** | 站点选择器 + 自动标题 |
| 2 | 新浪-股票频道 | trafilatura | **A:84.0** | 原生完美 |
| 3 | 财联社-深度 | scrapling+llm_clean | **B:65.2** | LLM 清洗层生效 |
| 4 | 财联社-详情 | llm-deep | **C:48.5** | 电报短内容 |
| 5 | 上交所 | trafilatura | **A:84.0** | 原生完美 |
| 6 | 深交所 | scrapling(.content) | **B:63.0** | 站点选择器 |
| 7 | 东财-数据中心 | trafilatura | **A:84.0** | 原生完美 |
| 8 | 东财-概念板块 | trafilatura | **A:84.0** | 原生完美 |
| 9 | **证券时报-文章** | scrapling(.detail-content-wrapper) | **B:73.5** | 站点选择器 |
| 10 | 格隆汇 | scrapling(.article-content) | **A:84.0** | 站点选择器 |
| 11 | 东财-研报中心 | scrapling(.main-content) | **B:79.6** | 站点选择器 |
| 12 | 国家统计局 | trafilatura | **A:84.0** | 原生完美 |

### 质量分布

```
A级 (≥80):  6/12 (50%)
B级 (60-79): 5/12 (42%)
C级 (40-59): 1/12 (8%)
成功率:     12/12 (100%) ✅
可用率:     12/12 (100%) ✅
```

### 从 Phase 1 → Phase 9 的演进

| 阶段 | 成功率 | 可用率 | A 级 | 平均质量 |
|------|--------|--------|------|---------|
| Phase 1 (纯静态) | ~80% | 25% | 8% | ~45 |
| Phase 3 (+Playwright) | ~80% | 67% | 25% | ~58 |
| Phase 6 (+站点选择器) | ~80% | 67% | 42% | ~66 |
| Phase 7 (+LLM) | ~90% | 75% | 50% | ~70 |
| Phase 8 (+LLM 清洗) | ~90% | 92% | 50% | 76.1 |
| **Phase 9 (最终优化)** | **100%** | **100%** | **50%** | **75.9** |

---

## Phase 9 新增优化

### 1. Playwright 站点特定等待策略
- `scraper_config.yaml` 新增 `site_wait` 配置
- 东财等待 `.contentwrap, #ContentBody, .main-content` (5s)
- 财联社等待 `.detail-telegraph-content, .article-content` (3s)
- 格隆汇等待 `.article-content, #article-body` (3s)
- 减少 JS 渲染页面内容未加载完成的问题

### 2. 数据源替换
- **雪球** (robots.txt 禁止，Skip) → **证券时报文章页**
- 证券时报首页 B:63 → 文章页 **B:73.5** (+17%)

### 3. 站点选择器扩展
- 新增 `stcn.com`: `.detail-content-wrapper`, `.detail-content`, `.content`
- 东财新增 `.main-content` (研报中心 C→B)

### 4. LLM 内容完整性检查
- `LLMExtractor.completeness_check()` 方法
- 检测提取内容是否完整（截断/缺失段落）
- 为后续自动重提取提供判断依据

---

## 引擎调用统计

| 引擎 | 次数 | 典型场景 |
|------|------|---------|
| trafilatura | 6 | 标准 HTML 完美提取 |
| scrapling(站点选择器) | 4 | 东财/格隆汇/深交所/证券时报 |
| scrapling(body) | 1 | 财联社深度 fallback |
| scrapling+llm_clean | 1 | 财联社深度 LLM 清洗 |
| llm-deep | 1 | 财联社电报困难页面 |

**成本**: 仅 2/12 页面需要 LLM 调用

---

## 命令速查

```bash
# 验证 DeepSeek 连接
python tools/test_llm_connection.py

# 运行 A-share 全链路测试
python -m tools.fetchers.web_fetcher --config config/a_share_ab_test.yaml --max-urls 12 --llm

# 验收测试
python tools/test_crawler_acceptance.py --quick
python tools/health.py
```
