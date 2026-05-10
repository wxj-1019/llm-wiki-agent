---
title: "数据模型总览"
type: source
tags: [数据库设计, SQLAlchemy, PostgreSQL, 数据模型]
date: 2026-05-09
source_file: raw/uploads/16_数据模型总览.md
---

## Summary

本文档详细定义了 A 股量化交易系统的完整数据模型，涵盖用户权限、股票基础、主力选股、回测、监控、投资组合、用户画像和支付等八大业务领域，采用 PostgreSQL Schema 隔离策略，包含 40+ 表的字段定义、索引设计和关联关系。该系统是 [[MainFundSelection|主力选股系统]] 的后端数据基础设施。

## Key Claims

- 数据库按业务领域划分为 7 个 Schema（public, stock_analysis, monitoring, portfolio, longhubang, sector_strategy, user_profiles），实现逻辑隔离和权限管理。
- 主力选股模块（`main_fund_selections` + `main_fund_selected_stocks`）存储完整的筛选参数、AI 分析结果、量化评分和交易建议。
- 回测模块（`main_fund_backtest_summary` + `main_fund_backtest_detail`）支持 1/3/5/10 天持有期的胜率和收益率统计，以及分策略和行业分布分析。
- 监控模块（`monitored_stocks` + `intraday_points`）支持分时数据、止盈止损、AI 分析和自动交易标记。
- 用户画像模块（`user_profiles`）记录投资风格、风险偏好、行为特征和能力评分，用于个性化推荐。
- 支付模块采用幂等键和乐观锁确保事务安全。
- 所有表采用自增 Integer 主键、统一时间戳、JSON/JSONB 灵活数据类型和软删除策略。

## Key Quotes

> "模型目录：`app/models/`"
> "Schema 分布：public / stock_analysis / monitoring / portfolio / longhubang / sector_strategy / user_profiles"

## Connections

- [[MainFundSelection]] — 数据模型为主力选股系统的完整后端架构
- [[Backtesting]] — 回测模块提供了胜率、平均收益等量化验证能力
- [[RiskManagement]] — 监控模块的止盈止损和 AI 分析支持风险控制
- 用户画像 — 用户画像模块实现个性化推荐
- [[A股市场]] — 整体面向 A 股量化交易场景
- [[PostgreSQL]] — 底层数据库，使用 Schema 隔离策略
- [[SQLAlchemy]] —— ORM 框架，模型目录为 `app/models/`

## Contradictions

- 无直接矛盾，但与 [[main-fund-selection-system-analysis|主力选股系统整体分析文档]] 结合可互补：本文档聚焦数据模型结构，那篇文档聚焦业务流程和 AI 分析逻辑。