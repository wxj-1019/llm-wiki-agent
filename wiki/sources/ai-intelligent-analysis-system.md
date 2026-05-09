---
title: "AI智能分析系统 — 多智能体协同分析引擎"
type: source
tags: [ai, multi-agent, stock-analysis, streaming, deepseek, qwen, kimi, glm]
date: 2026-05-09
source_file: raw/uploads/03_AI智能分析系统.md
---

## Summary

AI智能分析系统是[[MainFundSelection|主力选股系统]]平台的**核心智能引擎**，采用**多智能体协同架构（[[AIAgent|Multi-Agent]]）**，对单只股票进行9个维度的深度分析。系统支持REST API同步分析、WebSocket实时流式分析（10阶段推送）、SSE批量分析进度推送三种交互模式，并内置完整的请求治理机制（并发控制、熔断器、连接池、缓存优化）。支持[[DeepSeek]]/[[Qwen]]/[[Kimi]]/[[GLM]]四大AI提供商统一封装与动态切换。

## Key Claims

- 采用Facade外观模式封装9个AI分析师智能体，默认并发执行5个核心分析师（技术面、基本面、资金面、风险、新闻），另4个可选
- 三阶段分析流水线：多智能体并发分析 → 团队讨论综合模拟投研会议 → 最终投资决策（rating/action/target_price/stop_loss/confidence）
- 决策卡片校验逻辑：AI返回的目标价/止损价经过严格逻辑约束，矛盾时自动按默认比例重置
- 支持4大AI提供商统一封装：[[DeepSeek]]（含DeepSeek-R1推理过程）、[[Qwen]]、[[Kimi]]、[[GLM]]
- 请求优化器五层防护：并发控制（Semaphore 5）、重试（3次指数退避）、超时控制（60s）、熔断器（5次失败→180s冷却）、连接池复用
- WebSocket流式分析分10个阶段推送：INIT→STOCK_INFO→KLINE_DATA→FUNDAMENTAL_DATA→TECHNICAL_DATA→FUND_FLOW_DATA→RISK_DATA→NEWS_DATA→AI_ANALYSIS→FINAL_RESULT
- 批量分析（最多50只股票）使用SSE推送进度，支持取消任务
- 7种预设分析类型：comprehensive/technical/fundamental/risk/fund_flow/news/custom
- 价格获取策略链5种策略依次fallback，技术指标缺失时从K线补算RSI/MACD/KDJ/BOLL
- 深度诊断含阶段耗时追踪：semaphore_wait/client_wait/api_elapsed，慢请求自动记录

## Key Quotes

> "AI 智能分析系统是平台的**核心智能引擎**，采用多智能体协同架构（Multi-Agent），对单只股票进行9个维度的深度分析。"

> "采用 Facade 外观模式封装，所有智能体默认并发执行（300秒超时）。"

> "AI 返回的目标价/止损价会经过严格逻辑校验...若 AI 返回值逻辑矛盾，系统自动按默认比例重置。"

## Connections

- [[MainFundSelection|主力选股系统]] — AI智能分析是其核心智能引擎
- [[AIMultiAgentStockAnalysis|AI多智能体股票分析]] — 具体实现多智能体协同架构
- [[DeepSeek]] — 主要AI提供商，支持DeepSeek-R1推理过程
- [[Qwen]] — AI提供商，情感分析复用
- [[Kimi]] — AI提供商
- [[GLM]] — AI提供商
- [[price-monitoring-and-alert-system|价格监控与预警系统]] — AI分析结果可触发价格监控规则
- [[portfolio-management-and-analysis|持仓管理与组合分析]] — 持仓分析复用智能体
- [[user-profile-system|用户画像系统]] — 分析结果丰富用户画像
- [[RiskManagement|风险管理]] — [[RiskAnalystAgent]]直接服务于风险分析
- [[NewsAggregration|新闻聚合]] — 新闻分析师依赖新闻订阅系统
- [[SentimentAnalysis|情感分析]] — 市场情绪分析师维度
- [[TechnicalAnalysis|技术分析]] — 技术面分析师维度的支撑
- [[QuantitativeAnalysis|量化分析]] — 量化策略分析师维度
- [[Backtesting|回测验证]] — 分析结果可纳入回测
- [[Redis]] — 连接池管理与缓存支持
- [[APScheduler]] — 任务调度系统可能触发批量分析

## Contradictions

None detected with existing wiki content.