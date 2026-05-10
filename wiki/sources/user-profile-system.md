---
title: "用户画像系统 — 用户行为分析与个性化服务引擎"
type: source
tags: [user-profile, ai-analysis, stock-trading, personalization]
date: 2026-05-09
source_file: raw/uploads/11_用户画像系统.md
---

## Summary

用户画像系统是[[MainFundSelection|主力选股系统]]平台的用户行为分析与个性化服务引擎，通过5个并行收集器采集用户在股票分析、持仓、选股、板块分析和龙虎榜分析等维度的行为数据，利用LLM（如[[DeepSeek]]、[[Qwen]]、[[Kimi]]、[[GLM]]）生成用户的投资风格画像、能力评估和个性化标签，并支持关注股票的自动同步管理。

## Key Claims

- 系统通过5个并行收集器覆盖5大行为维度（股票分析、投资组合、板块分析、主力选股、龙虎榜分析），实现多维度用户行为采集
- AI大模型基于收集数据生成4大维度画像：投资风格（风险偏好、投资周期、投资理念）、投资偏好（市值偏好、行业/板块权重）、行为特征（交易频率、决策风格、分析深度）、能力评估（选股、风控、学习、综合评分）
- 每次画像生成记录快照版本历史，支持评分变化趋势追踪
- 关注股票支持从分析记录自动同步（分析≥3次自动加入关注），并支持CRUD操作
- 内存锁（`_generating_profiles`）防止并发重复生成，保证幂等性

## Key Quotes

> "用户画像系统是平台的用户行为分析与个性化服务引擎"
> "AI 大模型基于采集数据生成 4 大维度画像"
> "支持基于最近一次画像的增量数据更新"

## Connections

- [[MainFundSelection]] — 主力选股系统为该画像系统的重要数据源之一
- LLM — 使用[[DeepSeek]]、[[Qwen]]、[[Kimi]]、[[GLM]]等大模型进行用户行为分析和画像生成
- [[StockSelectionStrategy]] — 画像系统可用于推荐匹配用户风险偏好的选股策略
- [[RiskManagement]] — 能力评估包含风控评分（risk_control_score）
- [[MoneyFlowStrategy]] — 龙虎榜分析收集器关注游资类型，与资金流策略相关
- [[MultiFactorSelection]] — 多因子评分策略可作为画像驱动的推荐参考
- [[Backtesting]] — 画像驱动的策略推荐可通过回测验证匹配度

## Contradictions

None detected with existing wiki content.
