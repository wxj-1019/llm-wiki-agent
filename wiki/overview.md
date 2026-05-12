---
title: "Overview"
type: synthesis
tags: []
sources: [attention-is-all-you-need, intro-to-llms, main-fund-selection-system-analysis, a-share-quantitative-trading-strategies-guide, wangxinjie-backend-developer-resume, stock-data-service, backtest-engine, news-feed-system, task-scheduler-and-infrastructure]
last_updated: 2026-05-12
---

# Overview

*This page is maintained by the LLM. It is updated on every ingest to reflect the current synthesis across all sources.*

## Current Wiki State

The wiki contains **~313 pages** across 6 layers (sources, entities, concepts, syntheses, memory, overview) forming a dense knowledge graph centered on three major domains: **A-share quantitative trading systems**, **AI/LLM technology**, and **personal developer portfolio**.

## Domain 1: A-Share Quantitative Trading Platform

The largest knowledge cluster (~70% of content) documents an AI-powered A-share quantitative trading platform with the following subsystems:

### Core Selection Engine — [[MainFundSelection|主力选股系统]]
- **Six-layer pipeline architecture**: data ingestion → hard filtering → strategy matching → quantitative pre-scoring → AI five-dimension analysis → senior researcher synthesis
- **7 strategies**: [[ControlledPullback]], [[LowRiskIncome]], [[SectorRotation]], [[GrowthPotential]], [[ValueStable]], [[ShortTermBreakout]], [[MainForceAccumulation]]
- **5 AI analyst agents**: [[SentimentAnalystAgent]], [[NewsAnalystAgent]], [[FundamentalAnalystAgent]], [[TechnicalAnalystAgent]], [[MacroAnalystAgent]] plus [[RiskAnalystAgent]] and specialized agents
- **Quantitative pre-scoring**: [[QuantPreScoring]] with multi-factor scoring before AI analysis

### Data Infrastructure
- **[[DataPipeline|Data Pipeline]]**: Multi-source ingestion with [[WencaiAPI]] (primary) + [[Tushare]] (backup), 3-retry with exponential backoff, Fail-Closed quality gating
- **[[StockDataCoordinator]]**: Unified data source management with [[FourSourceDegradationChain|4-tier degradation chain]]
- **[[多层缓存策略]]**: [[Redis]]-backed multi-layer caching with TTL configuration
- **Real-time data**: [[大盘云图]] Treemap visualization, [[大盘指数服务]], [[板块策略数据服务]]

### Risk & Quality Control
- **[[RiskManagement]]**: 9-layer Fail-Closed defensive screening (data quality → hard filter → strategy filter → financial guardrails → technical filter → quant scoring → AI analysis → strategy matching → researcher synthesis)
- **[[Backtesting]]**: [[BackTrader]]-based strategy validation with [[WalkForwardAnalysis]] and [[MonteCarloSimulation]]
- **[[价格监控与预警系统|Price Monitoring & Alerting]]**: Real-time monitoring with [[AI智能盯盘]] and multi-rule alerting

### Platform Infrastructure
- **Auth**: [[用户与权限系统]] with [[JWT]] + [[bcrypt]] + [[RBAC]] + [[Redis]]-based CAPTCHA
- **Scheduling**: [[APScheduler]] with trading calendar awareness
- **Monitoring**: [[Prometheus]] metrics + [[DistributedTracing]] + [[RateLimiting]]
- **Notifications**: [[NotificationService]] with [[NotificationChannels|multi-channel delivery]] (email/SMS/in-app)
- **Payments**: [[SubscriptionPlan|3-tier membership]] with [[AlipayProvider]]

### Market Data Sources (Auto-ingested)
- Web-scraped A-share data from 东方财富网 (EastMoney): stocks, IPOs, sector analysis, market indices
- Financial news from 财联社 (CaiLianShe) and 新浪新闻 (Sina News)
- [[longhubang-analysis-system|龙虎榜分析系统]] for institutional flow tracking

## Domain 2: AI/LLM Technology Landscape

### Foundation Models
- **Transformer architecture**: [[Attention Is All You Need]] seminal paper, [[AttentionMechanism]], [[Transformer]]
- **Major models**: [[DeepSeek]] ([[DeepSeekV3]], [[DeepSeekR1]]), [[GPT4]], [[ChatGPT]], [[Claude]], [[Gemini]], [[Qwen]], [[LLaMA]], [[BERT]], [[T5]]
- **Key researchers & orgs**: [[OpenAI]], [[Anthropic]], [[GoogleDeepMind]], [[SamAltman]], [[IlyaSutskever]], [[Vaswani]]

### AI Agent Ecosystem
- **[[AIAgent|AI Agent]]** concepts: [[SelfImprovingAI]], [[MultiAgentCoordinationArchitecture]], [[AIMultiAgentStockAnalysis]]
- **Agent frameworks**: [[HermesAgent]] (⭐128K), [[AgentFrameworkComparison]]
- **Reasoning**: [[ChainOfThought]], [[InferenceScalingReasoning]]
- **Safety**: [[AIAlignment]], [[Slop]] (low-quality AI content)

### Development Tools
- [[ClaudeCode]] — Anthropic's CLI with [[Latte]] fork for multi-model support
- [[Bun]], [[Ink]] — CLI framework stack

## Domain 3: Developer Portfolio — [[王信杰]]

Personal profile of a backend developer with:
- **Internship**: [[海康威视]] (Python component platform, Java agile projects)
- **Projects**: [[能源大数据平台]] (5000 QPS via [[Redis]] cluster + [[SpringCloudAlibaba]]), [[慧公寓管理系统]] ([[HyperledgerFabric]] blockchain + [[ZKP]] + [[DeepLearning|DL]]/[[GeneticAlgorithm|GA]] hybrid optimization)
- **Tech stack**: [[SpringBoot]], [[Redis]], [[RocketMQ]], [[PostgreSQL]], [[SQLAlchemy]]

## Domain 4: Quantitative Trading Strategies

Comprehensive coverage of 14 A-share strategies from [[a-share-quantitative-trading-strategies-guide|A股常见量化交易策略指南]]:

| Strategy | Concept Page |
|---|---|
| 趋势跟踪 | [[TrendTracking]] |
| 均值回归 | [[MeanReversion]] |
| 动量策略 | [[MomentumStrategy]] |
| 资金流策略 | [[MoneyFlowStrategy]] |
| 多因子选股 | [[MultiFactorSelection]] |
| 事件驱动 | [[EventDriven]] |
| 板块轮动 | [[SectorRotation]] |
| 统计套利 | [[StatisticalArbitrage]] |
| 量价突破 | [[VolumePriceBreakout]] |
| 质量策略 | [[QualityStrategy]] |
| 价值策略 | [[ValueStrategy]] |
| 成长策略 | [[GrowthStrategy]] |
| 高股息低波 | [[HighDividendLowVol]] |
| 可转债套利 | [[ConvertibleBondArbitrage]] |

## Cross-Domain Connections

- [[ai-intelligent-analysis-system|AI智能分析系统]] bridges LLM technology with financial analysis via [[MultiAgentCoordinationArchitecture]]
- [[DeepSeek]] serves as the primary LLM backend for the entire platform (via [[DeepSeekClient]], [[AsyncDeepSeekClient]])
- [[StreamingAnalysisService]] provides real-time AI streaming analysis with [[ConnectionManager]] for SSE
- [[UserProfileSystem]] applies behavioral analytics to investment patterns

## Test Infrastructure

A small set of test documents validates the ingestion→graph rebuild pipeline: [[auto-graph-test]], [[final-iteration-test]], [[iteration-test]]. These are operational artifacts, not knowledge content.
