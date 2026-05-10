---
title: "回测引擎"
type: source
tags: [backtest, backtrader, quant, strategy]
date: 2026-05-09
source_file: raw/uploads/07_回测引擎.md
---

## Summary

回测引擎是平台的**策略验证与评估工具**，基于 [[BackTrader]] 框架封装，支持 6 种内置技术指标策略的回测、参数优化、策略对比、高级分析（[[WalkForwardAnalysis|Walk-Forward]]、[[MonteCarloSimulation|蒙特卡洛]]、组合回测、实时纸面交易）以及异步任务队列执行。系统采用 [[Redis]] 任务队列处理耗时回测请求，确保前端快速响应。覆盖从单次回测到复杂多策略组合的完整验证链路，是 [[MainFundSelection|主力选股系统]] 和 [[Backtesting]] 体系的核心组件。

## Key Claims

- 基于 [[BackTrader]] 框架封装，支持6种内置技术指标策略（[[RSIStrategy|RSI]]、[[EnhancedRSIStrategy|增强RSI]]、[[MACDStrategy|MACD]]、[[MAStrategy|均线]]、[[BollingerStrategy|布林带]]、[[KDJStrategy|KDJ]]）
- A股真实手续费模型（印花税0.1%卖出 + 佣金0.025%双向 + 过户费沪市0.002%）和自适应滑点
- 三种仓位管理模式：fixed（固定金额）/ percent（百分比）/ risk_based（风险比例）
- 高级分析支持：多进程并行优化、[[WalkForwardAnalysis|Walk-Forward]] 滚动窗口、[[MonteCarloSimulation|蒙特卡洛模拟]]（4种方法）、组合回测（5种权重分配）、实时纸面交易（WebSocket推送）
- 异步任务队列：[[Redis]] Hash/List 存储，最大并发3个，7天TTL，进度百分比分阶段上报
- 内存缓存（TTL 300秒）加速重复回测请求
- 潜在优化方向包括机器学习策略、多因子策略、Tick级回测和实盘对接

## Key Quotes

> "回测引擎是平台的策略验证与评估工具，基于 BackTrader 框架封装" — 系统概述

> "系统采用 Redis 任务队列处理耗时回测请求，确保前端快速响应" — 系统概述

## Connections

- [[Backtesting]] — 回测引擎是回测体系的技术实现核心，提供具体策略执行和验证能力
- [[MainFundSelection|主力选股系统]] — 回测引擎为选股系统提供策略验证和参数优化支撑
- [[DataPipeline|数据管道]] — 回测需要历史K线数据，通过 Tushare/AKShare 获取
- [[RiskManagement|风险管理]] — 回测中的止损止盈、追踪止损、VaR/CVaR分析是风险控制的重要手段
- [[TrendTracking|趋势跟踪]] — 均线策略本质是趋势跟踪的量化实现
- [[MeanReversion|均值回归]] — KDJ、布林带策略基于均值回归思想
- [[MomentumStrategy|动量策略]] — MACD策略包含动量成分
- [[ConvertibleBondArbitrage|可转债套利]] — 可转债的回测也可通过此引擎完成
- [[TechnicalAnalysis]] — 全部6种策略均基于技术分析指标
- [[GeneticAlgorithm]] — 参数优化可采用更高级的遗传算法替代网格搜索（优化点）
- [[AIMultiAgentStockAnalysis|AI多智能体股票分析]] — 机器学习策略扩展是潜在方向
- 强化学习 — 潜在优化方向之一
- LSTM — 潜在优化方向之一
- [[Tushare]] — 回测数据源之一
- [[AKShare]] — 回测数据源之一

## Contradictions

None detected.
