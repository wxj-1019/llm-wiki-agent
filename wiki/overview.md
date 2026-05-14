---
title: "Overview"
type: synthesis
tags: []
sources: [attention-is-all-you-need, intro-to-llms, main-fund-selection-system-analysis, a-share-quantitative-trading-strategies-guide, wangxinjie-backend-developer-resume, stock-data-service, backtest-engine, news-feed-system, task-scheduler-and-infrastructure, api-server-fastapi-backend-for-llm-wiki-viewer, ingest-tool-source-document-processing-engine, code-graph-base-protocol, build-graph-tool-knowledge-graph-builder, search-backend-abstraction-layer, pg-search-backend-postgresql-pgvector-search-backend, auto-ingest-pipeline-auto-ingest-py]
last_updated: 2026-05-14
---

# Overview

*This page is maintained by the LLM. It is updated on every ingest to reflect the current synthesis across all sources.*

## Current Wiki State

The wiki contains **~318 pages** across 6 layers (sources, entities, concepts, syntheses, memory, overview) forming a dense knowledge graph centered on three major domains: **A-share quantitative trading systems**, **AI/LLM technology**, **personal developer portfolio**, and **LLM Wiki tool infrastructure**.

The search backend layer now supports two implementations: the default [[WikiSearchEngine]] ([[SQLite]] FTS5) and the new [[PgSearchBackend]] ([[PostgreSQL]] + [[pgvector]]). Both implement the [[SearchBackend]] abstraction interface and are selectable via `config/database.yaml`. [[PgSearchBackend]] adds hybrid (FTS + vector) search, CJK-aware full-text via zhparser/bigram fallback, "did you mean" suggestions, and analytics logging.

The automation pipeline has two parallel paths: the legacy **batch pipeline** (fetcher → [[BatchCompiler]] → [[BatchIngest]] → [[IngestTool]]) and the new **fast path** (fetcher → [[AutoIngestPipeline]]), which performs deterministic, zero-LLM conversion with quality scoring, entity detection, and near-duplicate filtering.

## Domain 1: A-Share Quantitative Trading Platform

The largest knowledge cluster (~70% of content) documents an AI-powered A-share quantitative trading platform with the following subsystems:

### Core Selection Engine — [[MainFundSelection|主力选股系统]]
- **Six-layer pipeline architecture**: data ingestion → hard filtering → strategy matching → quantitative pre-scoring → AI five-dimension analysis → senior researcher synthesis
- **7 strategies**: [[ControlledPullback]], [[LowRiskIncome]], [[SectorRotation]], [[GrowthPotential]], [[ValueStable]], [[ShortTermBreakout]], [[MainForceAccumulation]]
- **Quant pre-scoring**: [[QuantPreScoring]] system scores stocks before AI analysis
- **5 AI analysts**: [[TechnicalAnalystAgent]], [[FundamentalAnalystAgent]], [[SentimentAnalystAgent]], [[FundFlowAnalystAgent]], [[MacroAnalystAgent]] in coordinated multi-agent architecture

### Supporting Subsystems
- [[stock-data-service]] — unified data source management with multi-level degradation chain ([[WencaiAPI]] → [[TusharePro]] → [[AKShare]] → [[TushareClient]])
- [[sector-strategy-and-market-analysis]] — fund flow, AI diagnosis, market map treemap, 8 major indices
- [[longhubang-analysis-system]] — tracking hot money and institutional trading patterns
- [[backtest-engine]] — six indicator-based strategies, parameter optimization, Monte Carlo simulation
- [[price-monitoring-and-alert-system]] — real-time monitoring, technical indicator alerts, AI-powered surveillance
- [[portfolio-management-and-analysis]] — portfolio tracking, AI diagnosis, risk assessment
- [[news-feed-system]] — 5 financial news sources × AI sentiment analysis × A-share entity extraction
- [[task-scheduler-and-infrastructure]] — APScheduler, Redis caching, rate limiting, distributed tracing, Prometheus monitoring
- [[user-auth-and-permission-system]] — JWT + bcrypt + RBAC lifecycle management
- [[subscription-payment-system]] — three-tier membership, Alipay integration, usage limits
- [[notification-and-messaging-system]] — email, SMS, in-app notification channels
- [[user-profile-system]] — 5 parallel collectors × AI 4-dimension profiling
- [[data-model-overview]] — 7 schemas, 40+ tables with indexes and relationships
- [[admin-backend-system]] — port 8586 admin console for operations and AI configuration

### 14 A-Share Quantitative Trading Strategies
| Strategy | Type | Description |
|---|---|---|
| [[TrendTracking]] | Trend | Follow established price trends |
| [[MomentumStrategy]] | Momentum | Cross-sectional momentum ranking |
| [[MeanReversion]] | Mean-reversion | Buy oversold, sell overbought |
| [[VolumePriceBreakout]] | Breakout | Volume-confirmed price breakouts |
| [[MultiFactorSelection]] | Multi-factor | Composite scoring across dimensions |
| [[MoneyFlowStrategy]] | Flow | Track institutional capital flows |
| [[SectorRotation]] | Rotation | Select strongest sectors first |
| [[EventDriven]] | Event | Capitalize on corporate events |
| [[ConvertibleBondArbitrage]] | Arbitrage | CB- equity arbitrage |
| [[StatisticalArbitrage]] | Arbitrage | Pairs trading/cointegration |
| [[ValueStrategy]] | Value | Low PE/PB with stable fundamentals |
| [[GrowthStrategy]] | Growth | High earnings growth premium |
| [[QualityStrategy]] | Quality | Strong profitability and financial health |
| [[HighDividendLowVol]] | Defensive | Stable income with low drawdown |

## Domain 2: AI/LLM Technology

Covers foundational LLM concepts, the Transformer revolution, 2024 developments, and agent architectures:

### Foundation Papers & Frameworks
- **[[Transformer]]**: Introduced by [[Vaswani]] et al. in "[[attention-is-all-you-need]]" (2017) — the architecture underlying [[GPT]], [[BERT]], [[T5]], [[LLaMA]] and every modern LLM
- **[[AttentionMechanism]]**: Originated by [[Bahdanau]] for neural machine translation, extended by the Transformer's multi-head self-attention
- **[[ChainOfThought]]**: Explicit intermediate reasoning steps that improve LLM performance on complex tasks
- **[[InferenceScalingReasoning]]**: Models like [[o1]], [[DeepSeekR1]], [[QwQ]], and [[Gemini2.0FlashThinking]] that scale test-time compute

### 2024 LLM Landscape (from [[ThingWeLearnedAboutLLMsIn2024]])
- **Capabilities plateau**: Models converged on chatbot Q&A; gains now in reliability, instruction following, and honesty
- **Reasoning frontier**: [[o1]], [[DeepSeekR1]], [[QwQ]] improved math/science; still early for real-world tools
- **Multimodality**: All major labs released vision models; audio/video production still separate
- **Synthetic data**: Used for reasoning training (math, code); risk of [[ModelCollapse]] from [[Slop]] pollution
- **Agent breakthroughs**: [[Claude]] computer use, [[Gemini2.0Flash]] agentic search; safety systems limited
- **2025 prediction**: Apple-level on-device intelligence, smaller specialized models, agent-focused improvements

### Key Entities
- **Major labs**: [[OpenAI]], [[Anthropic]], [[GoogleDeepMind]], [[Meta]], [[DeepSeek]]
- **Key people**: [[SamAltman]], [[GregBrockman]], [[IlyaSutskever]], [[AmandaAskell]], [[SimonWillison]]
- **Products**: [[ChatGPT]], [[Claude]], [[Gemini]], [[NotebookLM]], [[ClaudeArtifacts]], [[ClaudeCode]]

### Agent Ecosystem
- [[AIAgent]] — autonomous perception, decision-making, and execution
- [[HermesAgent]] — self-improving agent (⭐128K), part of [[NousResearch]] ecosystem
- [[AgentFrameworkComparison]] — comparative analysis of agent architectures
- [[SelfImprovingAI]] — systems that learn from operational experience

## Domain 3: LLM Wiki Tool Infrastructure

The wiki tools themselves are documented as a meta-layer:

### Core Tools
- [[IngestTool]] — LLM-powered source ingestion engine
- [[AutoIngestPipeline]] — zero-LLM fast-path automation pipeline with quality scoring and dedup
- [[QueryTool]] — natural language query engine with CJK-aware page relevance
- [[HealthTool]] — deterministic structural health checker (zero LLM calls)
- [[LintTool]] — content quality checks (orphans, broken links, contradictions)
- [[BuildGraphTool]] — two-pass knowledge graph builder with community detection
- [[HealTool]] — auto-heal missing entity pages
- [[RefreshTool]] — hash-based change detection

### Automation Pipeline
- [[Fetchers]] — RSS, arXiv, GitHub, web scrapers producing `.md` files
- [[AutoIngestPipeline]] — deterministic zero-LLM fast-path conversion with quality scoring (threshold 30/100), entity detection, content fingerprinting for near-duplicate detection, and post-ingest graph rebuild trigger
- [[Scheduler]] — cross-platform daemon running full pipeline on schedule
- [[StateManagement]] — state.json persistence for processed URLs and hashes

### Frontend (React)
- **Architecture**: React 18 + TypeScript + Vite, Tailwind CSS 4, Zustand, vis-network
- **Key components**: [[WikiStore]], [[DataService]], [[Header]], [[Sidebar]], [[ChatPage]], [[GraphPage]], [[SearchPage]]
- **State flow**: `dataService.ts` fetches → `wikiStore.ts` (Zustand) → React components via selectors
- **i18n**: [[i18next]] + [[react-i18next]] with en/zh-CN
- **Key hooks**: [[UseDebounce]], [[useEventStream]], [[useKeyboardShortcuts]], [[useAgentChat]]

### Search Infrastructure
- [[SearchBackend]] — pluggable abstraction layer
- [[WikiSearchEngine]] — default SQLite FTS5 backend
- [[PgSearchBackend]] — PostgreSQL + pgvector backend with hybrid search, CJK FTS, "did you mean"

## Domain 4: Personal Developer Portfolio
- [[WangXinjie]] — backend engineer, internship at [[Hikvision]]
- Projects: [[EnergyBigDataPlatform]] (Spring Boot + Redis cluster, 5000 QPS) and [[SmartApartmentSystem]] (Hyperledger Fabric + ZKP)

## Quality Assessment
- **Link density**: High (many cross-references between A-share subsystems, LLM concepts, and tool documentation)
- **Balance**: Strong depth in A-share trading (70%) and LLM Wiki tools (20%); thinner in AI/LLM theory (10%)
- **Data gaps**: Limited coverage of actual financial market data, minimal coding tutorials, no external API usage patterns beyond A-share domain
