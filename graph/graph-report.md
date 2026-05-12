# Graph Insights Report — 2026-05-13

## Health Summary
- **300** nodes, **4434** edges (14.78 edges/node — ✅ healthy)
- **0** orphan nodes (0.0%) — target: <10%
- **10** communities
- Link density: 0.0382

## 🔴 Orphan Nodes (0 pages, 0.0%)
No orphan nodes — excellent!

## 🟡 God Nodes (Hub Pages)
These nodes carry disproportionate connectivity (degree > μ+2σ). Verify they are comprehensive:

| Node | Degree | % of Edges | Community |
|---|---|---|---|
| `overview` | 136 | 1.5% | 0 |
| `concepts/RiskManagement` | 105 | 1.2% | 2 |
| `concepts/QuantitativeAnalysis` | 99 | 1.1% | 2 |
| `entities/A股市场` | 78 | 0.9% | 2 |
| `concepts/StockSelectionStrategy` | 71 | 0.8% | 2 |
| `entities/MainFundSelection` | 71 | 0.8% | 2 |
| `concepts/Backtesting` | 70 | 0.8% | 2 |
| `concepts/DataPipeline` | 68 | 0.8% | 4 |
| `concepts/MultiFactorSelection` | 64 | 0.7% | 2 |
| `sources/a-share-quantitative-trading-strategies-guide` | 59 | 0.7% | 2 |
| `entities/LargeLanguageModels` | 54 | 0.6% | 0 |
| `concepts/SentimentAnalysis` | 53 | 0.6% | 2 |
| `entities/OpenAI` | 53 | 0.6% | 0 |
| `concepts/EventDriven` | 52 | 0.6% | 2 |

## 🟡 Fragile Bridges
Community pairs connected by only 1 edge — one deleted link breaks them:
- Community 0 ↔ Community 6 via `sources/article-15d035` → `concepts/AIAgent`
- Community 0 ↔ Community 7 via `entities/Evaluation` → `entities/RiskManagement`
- Community 1 ↔ Community 7 via `sources/article-d20211` → `concepts/ThreeStageAnalysisPipeline`
- Community 2 ↔ Community 9 via `entities/article-3e682d` → `entities/海康威视`
- Community 4 ↔ Community 6 via `sources/article-15d035-1` → `concepts/MarketMapTreemap`
- Community 4 ↔ Community 9 via `entities/article-e4f097` → `entities/海康威视`
- Community 5 ↔ Community 8 via `entities/AIRequestOptimizer` → `entities/ThreadingRebuildTest`

## 🟢 Community Overview

| Community | Nodes | Key Members |
|---|---|---|
| 0 | 121 | overview, entities/LargeLanguageModels, entities/OpenAI, entities/ChatGPT, concepts/Transformer, … |
| 1 | 33 | sources/ai-intelligent-analysis-system, concepts/StreamingAnalysis, sources/portfolio-management-and-analysis, concepts/MultiAgentCoordinationArchitecture, concepts/ThreeStageAnalysisPipeline, … |
| 2 | 90 | concepts/RiskManagement, concepts/QuantitativeAnalysis, entities/A股市场, concepts/StockSelectionStrategy, entities/MainFundSelection, … |
| 3 | 6 | entities/article-8d07c7, entities/财联社, entities/界面新闻, entities/上海界面财联社科技, entities/金融数据服务, … |
| 4 | 84 | concepts/DataPipeline, entities/Tushare, entities/价格监控与预警系统, concepts/AlertSystem, entities/股票数据服务, … |
| 5 | 59 | entities/Redis, concepts/CacheManagement, entities/APScheduler, entities/PostgreSQL, concepts/UserProfiling, … |
| 6 | 18 | sources/article-15d035-1, sources/article-15d035, entities/价值投资, entities/巴菲特, entities/奥马哈, … |
| 7 | 8 | sources/article-d20211, entities/article-4c695c, entities/RiskManagement, entities/中金公司, concepts/A股市场, … |
| 8 | 15 | sources/log-verify-test, sources/graph-rebuild-verify, sources/auto-graph-test, sources/final-iteration-test, sources/finally-block-test, … |
| 9 | 6 | entities/海康威视, concepts/IoT, concepts/安防, concepts/智能家居, concepts/视频监控, … |

## 🟠 Phantom Hubs (referenced but non-existent pages)
These pages are referenced by 2+ existing pages but don't exist yet.
They represent strong page creation signals — prioritize by reference count:

| Page Name | References | Referenced By |
|---|---|---|
| `[[惠康科技]]` | 2 | sources/article-0dfb70, sources/article-c889ca |

## Suggested Actions
1. Review god nodes for stub content vs. genuine hubs
2. Strengthen fragile bridges with cross-references
3. Create pages for top phantom hubs (start with `[[惠康科技]]` — 2 references)
