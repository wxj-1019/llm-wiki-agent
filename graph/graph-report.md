# Graph Insights Report — 2026-05-13

## Health Summary
- **300** nodes, **4456** edges (14.85 edges/node — ✅ healthy)
- **0** orphan nodes (0.0%) — target: <10%
- **8** communities
- Link density: 0.0380

## 🔴 Orphan Nodes (0 pages, 0.0%)
No orphan nodes — excellent!

## 🟡 God Nodes (Hub Pages)
These nodes carry disproportionate connectivity (degree > μ+2σ). Verify they are comprehensive:

| Node | Degree | % of Edges | Community |
|---|---|---|---|
| `overview` | 136 | 1.5% | 2 |
| `concepts/RiskManagement` | 106 | 1.2% | 4 |
| `concepts/QuantitativeAnalysis` | 99 | 1.1% | 4 |
| `entities/A股市场` | 80 | 0.9% | 4 |
| `concepts/StockSelectionStrategy` | 71 | 0.8% | 4 |
| `entities/MainFundSelection` | 71 | 0.8% | 4 |
| `concepts/Backtesting` | 70 | 0.8% | 4 |
| `concepts/DataPipeline` | 68 | 0.8% | 1 |
| `concepts/MultiFactorSelection` | 64 | 0.7% | 4 |
| `sources/a-share-quantitative-trading-strategies-guide` | 59 | 0.7% | 4 |
| `entities/LargeLanguageModels` | 54 | 0.6% | 2 |
| `entities/OpenAI` | 53 | 0.6% | 2 |
| `concepts/EventDriven` | 52 | 0.6% | 0 |
| `concepts/SentimentAnalysis` | 52 | 0.6% | 5 |

## 🟡 Fragile Bridges
Community pairs connected by only 1 edge — one deleted link breaks them:
- Community 1 ↔ Community 7 via `sources/article-15d035-1` → `concepts/MarketMapTreemap`
- Community 2 ↔ Community 7 via `sources/article-15d035` → `concepts/AIAgent`
- Community 3 ↔ Community 5 via `concepts/NeuralNetworks` → `concepts/SentimentAnalysis`

## 🟢 Community Overview

| Community | Nodes | Key Members |
|---|---|---|
| 0 | 59 | concepts/EventDriven, concepts/AlertSystem, entities/PostgreSQL, concepts/UserProfiling, entities/RateLimiting, … |
| 1 | 70 | concepts/DataPipeline, entities/价格监控与预警系统, entities/Tushare, entities/Redis, concepts/CacheManagement, … |
| 2 | 118 | overview, entities/LargeLanguageModels, entities/OpenAI, entities/ChatGPT, concepts/AIAgent, … |
| 3 | 17 | concepts/NeuralNetworks, sources/graph-rebuild-verify, sources/log-verify-test, sources/auto-graph-test, sources/final-iteration-test, … |
| 4 | 110 | concepts/RiskManagement, concepts/QuantitativeAnalysis, entities/A股市场, concepts/StockSelectionStrategy, entities/MainFundSelection, … |
| 5 | 44 | concepts/SentimentAnalysis, sources/ai-intelligent-analysis-system, concepts/StreamingAnalysis, sources/portfolio-management-and-analysis, concepts/MultiAgentCoordinationArchitecture, … |
| 6 | 6 | entities/海康威视, concepts/工业视觉, concepts/IoT, concepts/智能家居, concepts/视频监控, … |
| 7 | 18 | sources/article-15d035-1, sources/article-15d035, entities/价值投资, entities/标普500指数, entities/查理芒格, … |

## 🟠 Phantom Hubs (referenced but non-existent pages)
No phantom hubs — all referenced pages exist.

## Suggested Actions
1. Review god nodes for stub content vs. genuine hubs
2. Strengthen fragile bridges with cross-references
