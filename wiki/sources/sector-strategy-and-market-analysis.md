---
title: "板块策略与大盘分析"
type: source
tags: [sector-strategy, market-map, market-index, a-share, treemap]
date: 2026-05-09
source_file: raw/uploads/06_板块策略与大盘分析.md
---

## Summary

板块策略与大盘分析模块是[[MainFundSelection|主力选股系统]]平台的**中观市场分析工具**，覆盖行业板块和概念板块的资金流向、涨跌幅分布、AI诊断预测能力，同时提供大盘云图（Treemap）可视化数据和8大主要指数实时行情。系统采用5分钟快照缓存、Raw+Published双表版本管理、四源降级链（Tushare→申万→东方财富→新浪）和交易时间感知定时任务，确保数据高可用性与前端响应速度。

## Key Claims

- 板块数据采集基于`SectorDataProvider`，支持行业/概念列表与行情、成分股、北向资金、新闻、K线和资金流向，主数据源为新浪/同花顺/AKShare，备用数据源为东方财富/Tushare
- 全局并发限制`asyncio.Semaphore(3)`防止数据源过载，失败源自动记忆避免重复尝试，内置风控检测HTML错误页
- 申万行业映射`sw_index_map`覆盖31个一级行业及细分行业，用于多数据源间的分类对齐
- 快照机制有效期5分钟，支持多周期快照（1m/3m/1y/5y/all），优先读`SystemSnapshot`快照→`MarketMapPublished`→轻量级fallback
- AI板块分析调用`SectorAgentsService`多智能体分析，Token独立统计并持久化到`UserTokenUsageRecord`，分析维度包括板块资金流向、成分股强度、行业景气度、政策催化、风险因素
- 大盘云图采用Raw+Published双表版本管理，每次刷新递增版本号，旧版本标记deprecated，数据类型区分tushare_base/sina_realtime/mixed/price_refresh
- K线缓存服务（`StockKlineCacheService`）优先读`StockKlineCache`表（24h TTL），未命中则调Tushare daily，批量刷新按股票维度原子化
- 覆盖8大A股主要指数（上证指数、深证成指、创业板指、科创50、沪深300、中证500、中证1000、创业板50），每1分钟自动刷新，仅交易时间执行
- 交易时间感知：集成`trade_cal`交易日历，非交易时间自动跳过定时任务

## Key Quotes

> "板块策略与大盘分析模块是平台的中观市场分析工具，覆盖行业板块、概念板块的资金流向、涨跌幅分布、AI诊断预测等能力，同时提供大盘云图（Treemap）可视化数据和主要指数实时行情。"

> "快照机制缓存市场综合数据，减少重复 Heavy Request，确保前端快速响应。" — 系统概述

> "双表机制：MarketMapRaw（原始数据）保存从各数据源获取的原始云图数据；MarketMapPublished（发布对照表）版本化管理，对外提供的数据以该表为准。" — 大盘云图数据架构

## Connections

- [[MainFundSelection]] — 板块策略与大盘分析是主力选股系统的中观市场分析层，提供板块级别的选股上下文
- [[SectorRotation]] — 板块轮动策略与本模块的板块资金流向和AI分析直接相关
- [[DataPipeline]] — 四源降级链、Redis/DB双层缓存、快照机制属于数据管道的核心实现
- [[A股市场]] — 整体面向A股市场，覆盖31个申万一级行业
- [[Backtesting]] — 板块策略的历史回溯可辅助回测系统的中观维度验证
- [[MoneyFlowStrategy]] — 板块资金流向数据是资金流策略的重要输入
- [[RiskManagement]] — 板块级别的风险因素分析是风控的一部分
- [[Redis]] — 缓存云图数据和板块概览，TTL可配置
- [[PostgreSQL]] — 双表持久化存储云图数据
- [[Prometheus]] — 相关模块的定时任务刷新可通过监控系统暴露指标
- [[APScheduler]] — 定时任务调度引擎，驱动板块数据刷新
- [[AIMultiAgentStockAnalysis]] — AI板块分析调用SectorAgentsService多智能体分析

## Contradictions

- 文档声称快照有效期5分钟，但同时提到`refresh_all_market_data()`作为定时任务刷新全量数据并生成快照。如果定时任务频率小于5分钟，快照机制的保护效果减弱；如果大于5分钟，可能存在5分钟内同一请求重复触发的风险。与实际实现中的定时频率需进一步核实。
- 涨跌刷新任务每5分钟执行一次但仅交易时间，而大盘指数刷新每1分钟执行一次。两者频率不一致可能导致指数数据比板块数据更新更频繁，前端展示可能出现时间错位。
- 文档提到大盘云图数据源降级链为"Tushare→申万→东方财富→新浪"，而板块数据采集的主数据源为"新浪/同花顺/Tushare"，备用为"东方财富"。两个降级链的优先级顺序不一致，映射到具体数据时可能存在混淆。

## Optimization Points Noted

| 优化方向 | 说明 |
|----------|------|
| 板块轮动信号 | 增加板块轮动强度指数，识别资金在板块间的流动趋势 |
| 云图前端交互 | 支持前端筛选（按市值/涨跌幅/行业过滤），减少传输数据量 |
| 板块联动分析 | 分析板块间的领先-滞后关系，识别领涨/跟涨板块 |
| 历史回溯 | 支持查看任意历史日期的云图快照，用于复盘 |