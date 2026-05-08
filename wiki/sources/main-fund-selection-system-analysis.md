---
title: "主力选股系统整体分析文档"
type: source
tags: [stock-selection, ai-analysis, quant-scoring, backtest, system-design]
date: 2026-05-06
source_file: raw/uploads/MAIN_FUND_SELECTION_ANALYSIS.md
---

## Summary

本文档详细描述了一套[[AIAgent|AI驱动的]]旗舰智能选股系统"主力选股"的完整架构。该系统采用从数据获取到回测验证的六层流水线设计，集成了7种选股策略、量化预评分系统、5位[[AIAgent|AI分析师]]并行分析、资深研究员综合决策和自动回测验证机制，目标是从全市场主力资金流入股票中每日精选3-10只最优标的。

## Key Claims

- 系统采用"数据获取 → 多层级筛选 → 量化预评分 → [[AIAgent|AI五维分析]] → 资深研究员综合 → 回测验证"的六层架构，每一层都是Fail-Closed设计
- 内置7种选股策略（主力吸筹、短期爆发、价值稳健、成长潜力、板块轮动、低风险收益、温和回调多头），各有独立的过滤条件、量化权重和适配标准
- 量化预评分系统（[[QuantitativeAnalysis|Quant Scorer]]）从资金强度35分、量价配合30分、基本面20分、估值安全15分四个维度综合评分，并叠加策略专属公式Overlay
- 5位[[AIAgent|AI分析师]]（资金流向、行业板块、财务基本面、技术形态、量化）通过asyncio.Semaphore并行执行，资深研究员汇总输出推荐
- 推荐分层双轨制："优先推荐"（strict）和"谨慎参考"（caution），后者包含4种具体场景
- 回测引擎使用T+1开盘价、双边总成本0.23%的模型，支持1/3/5/10日持有期
- 系统包含丰富的降级策略：AI不可用时按量化+风控规则降级，推荐数量不足时量化回填
- 涉及重要数据源：[[WencaiAPI|问财API]]（pywencai）和[[Tushare|Tushare API]]

## Key Quotes

> "主力选股是系统的旗舰智能选股功能，采用「数据获取 → 多层级筛选 → 量化预评分 → AI五维分析 → 资深研究员综合 → 回测验证」的六层架构"

> "每一层都是Fail-Closed（失败时返回空而非放行），确保推荐质量"

## Connections

- [[AIAgent]] — AI分析师体系和资深研究员是该系统的核心智能层
- [[LargeLanguageModels]] — 5位AI分析师和资深研究员均基于LLM驱动
- [[QuantitativeAnalysis]] — 量化预评分系统是AI分析前的关键过滤层
- [[Backtesting]] — 自动回测验证系统形成闭环
- [[RiskManagement]] — 多层防御式筛选和降级策略体现风控设计
- [[DataPipeline]] — 数据获取层（[[WencaiAPI|问财API]]、[[Tushare|Tushare]]）构成基础
- [[Tushare]] — 技术指标计算与备选数据源
- [[WencaiAPI]] — 主要数据源
- [[MainFundSelectionSystem|MainFundSelection]] — 主力选股系统的核心实体

## Contradictions

- 本文档与现有wiki内容无直接矛盾，但引入了新的中国A股金融领域知识（选股策略、量化评分、回测等），属于领域扩展而非冲突