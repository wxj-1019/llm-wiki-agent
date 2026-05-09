---
title: "Main Fund Selection System — 主力选股系统"
type: source
tags: [stock-selection, ai-analysis, multi-agent, quantitative, backtesting]
date: 2026-05-09
source_file: raw/uploads/04_主力选股系统.md
---

## Summary

主力选股系统是[[MainFundSelection|主力选股系统]]平台的**旗舰智能选股功能**，采用六层流水线架构（数据获取→多层级筛选→量化预评分→AI五维分析→资深研究员综合→回测验证），从全市场主力资金流入股票中每日精选3-10只最优标的。系统内置7种策略、五位AI分析师并行协作、量化评分与公式Overlay层，以及完善的降级和回测闭环。

## Key Claims

- 六层流水线架构：数据获取（主源[[WencaiAPI|问财API]]/备用[[Tushare]]）→ 数据清洗+硬过滤 → 技术指标注入 → 量化预评分 → AI五维分析 → 资深研究员综合 → 回测验证
- 7种内置策略：[[MainForceAccumulation|主力吸筹]]、[[ShortTermBreakout|短期爆发]]、[[ValueStable|价值稳健]]、[[GrowthPotential|成长潜力]]、[[SectorRotation|板块轮动]]、[[LowRiskIncome|低风险收益]]、[[ControlledPullback|温和回调多头]]
- 量化预评分（Quant Scorer）：四大维度总分100分（资金强度35分+量价配合30分+基本面20分+估值安全15分），含策略自适应权重和公式Overlay层
- 5位AI分析师并行：资金流向分析师、行业板块分析师、财务基本面分析师、技术形态分析师、量化分析师
- 资深研究员综合输出推荐（分层双轨制：优先推荐/谨慎参考），含仓位/周期/入场区间/卖出区间/信心度
- 回测闭环：T+1开盘价买入，支持1/3/5/10日持有周期，成本模型包含滑点+冲击+佣金+印花税
- 多层防御式筛选：硬过滤→Guardrails→技术指标→量化评分→AI分析→策略适配
- 推荐分层：优先推荐（`strict`）和谨慎参考（`caution`）双轨制

## Key Quotes

> "主力选股是平台的**旗舰智能选股功能**，采用'数据获取 → 多层级筛选 → 量化预评分 → AI五维分析 → 资深研究员综合 → 回测验证'的六层架构"
> "从全市场主力资金流入股票中，通过AI协同分析每日精选出 **3-10只** 最优投资标的"
> "多层防御式筛选：硬过滤 → Guardrails → 技术指标 → 量化评分 → AI分析 → 策略适配，层层收敛"

## Connections

- [[MainFundSelection]] — 主力选股系统的主体
- [[WencaiAPI|问财API]] — 主力数据源
- [[Tushare]] — 备用数据源
- [[AIMultiAgentStockAnalysis]] — 五维AI分析师协同
- [[QuantPreScoring]] — 量化预评分系统
- [[QuantitativeAnalysis]] — 量化评分方法论
- [[Backtesting]] — 回测验证闭环
- [[MainForceAccumulation]] — 主力吸筹策略
- [[ShortTermBreakout]] — 短期爆发策略
- [[ValueStable]] — 价值稳健策略
- [[GrowthPotential]] — 成长潜力策略
- [[SectorRotation]] — 板块轮动策略
- [[LowRiskIncome]] — 低风险收益策略
- [[ControlledPullback]] — 温和回调多头策略
- [[DataPipeline]] — 数据获取与清洗层
- [[RiskManagement]] — Guardrails风险护栏
- [[MoneyFlowStrategy]] — 资金流向分析
- [[TechnicalAnalysis]] — 技术形态分析
- [[user-auth-and-permission-system|用户与权限系统]] — 用户入口
- [[longhubang-analysis-system|龙虎榜分析系统]] — 龙虎榜联动
- [[ai-intelligent-analysis-system|AI智能分析系统]] — AI分析能力复用
- [[backtest-engine|回测引擎]] — 回测能力支撑

## Contradictions

None detected.
