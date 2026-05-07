---
title: "A股常见量化交易策略指南"
type: source
tags: [a-share, quantitative-trading, strategy-guide, system-design]
date: 2026-05-07
source_file: raw/uploads/A股常见量化交易策略指南.md
---

## Summary

本文档全面梳理了适合 [[A股市场]] 的 14 种常见量化交易策略，包括 [[TrendTracking|趋势跟踪]]、[[MomentumStrategy|动量]]、[[MeanReversion|均值回归]]、[[VolumePriceBreakout|量价突破]]、[[MoneyFlowStrategy|资金流]]、[[SectorRotation|板块轮动]]、[[MultiFactorSelection|多因子选股]]、[[ValueStrategy|价值]]、[[GrowthStrategy|成长]]、[[QualityStrategy|质量]]、[[HighDividendLowVol|高股息低波]]、[[EventDriven|事件驱动]]、[[StatisticalArbitrage|统计套利/配对交易]] 和 [[ConvertibleBondArbitrage|可转债套利]]。文档从 A 股独特市场特征（涨跌停、T+1、做空限制、政策驱动、题材轮动）出发，分析了每种策略的核心逻辑、常见信号、优缺点和实战落地要点，并为当前主力选股系统提供了四种最适合优先工程化的策略类型：[[主力资金流入策略|主力资金流入]]、[[板块轮动策略|板块轮动]]、[[TrendMomentum|趋势+动量复合]] 和 [[多因子评分策略|多因子评分]]。

## Key Claims

- A 股量化策略需要单独理解，涨跌停制度、T+1 交割、做空限制、题材轮动和政策驱动特征显著影响策略有效性
- 每种策略有各自最适合的市场状态：趋势跟踪适合单边上涨和结构性牛市，均值回归适合震荡市，动量策略适合赚钱效应明显的热点扩散阶段
- 最常见的策略失败原因包括：忽略成交可行性、未来函数、过拟合、风格切换失效、忽略交易成本和仓位管理
- 最适合当前[[AIAgent|AI智能选股系统]]优先工程化的四类策略是：主力资金流入策略、板块轮动策略、趋势+动量复合策略、多因子评分策略
- 最稳妥的路线是采用"多因子底座 + A 股特色信号（资金流、板块、情绪）+ 严格交易风控"的组合架构

## Key Quotes

> "A 股量化策略并不只是几个名词，它们背后分别代表不同的赚钱机制：趋势和动量赚的是'强者恒强'，均值回归赚的是'短期偏离后的修复'，资金流和板块轮动赚的是'资金博弈和主线扩散'"

> "在 A 股做量化，不能只学'通用策略名字'，更要理解：这个策略靠什么赚钱、这个策略在 A 股为什么有效、这个策略最怕什么市场环境、这个策略落地时要加什么风控"

> "只看收益率，不看成交可行性" — 最常见的策略失败原因之首

## Connections

- [[AIAgent]] — 主力选股系统的 AI 分析层可利用本指南中的策略框架
- [[QuantitativeAnalysis]] — 多因子评分策略与量化预评分系统直接相关
- [[MainFundSelectionSystem|主力选股系统]] — 本指南中的四种优先策略直接服务于主力选股系统的策略体系
- [[RiskManagement]] — 每种策略特有的风控参数和失败原因与系统风控设计相关
- [[DataPipeline]] — 资金流数据和板块数据的获取需求与数据获取层相关
- [[TrendTracking]] — 趋势跟踪策略与系统中"温和回调多头"策略相关
- [[SectorRotation]] — 板块轮动策略与系统中"板块轮动"策略直接对应
- [[MultiFactorSelection]] — 多因子评分与系统的量化预评分体系一致

## Contradictions

- 本文档与[[main-fund-selection-system-analysis|主力选股系统整体分析文档]]无直接矛盾，但本文档提供了更完整的策略理论框架，可以丰富主力选股系统的策略描述和风险说明
- 本文档强调板块轮动策略和趋势+动量复合策略，这与主力选股系统已内置的 7 种策略体系互补，不冲突