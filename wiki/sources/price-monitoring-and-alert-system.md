---
title: "价格监控与预警系统"
type: source
tags: [price-monitoring, alert-system, risk-management, ai-monitoring, real-time-trading]
date: 2026-05-09
source_file: raw/uploads/08_价格监控与预警系统.md
---

## Summary

价格监控与预警系统是平台的**实时盯盘与风控工具**，支持用户对股票设置价格监控、技术指标告警、[[AI智能盯盘]]和多规则[[风险预警]]。系统采用分时线服务缓存日内价格数据，监控引擎仅在交易时间执行检查，触发告警后自动停用监控并生成交易计划，与[[通知与消息系统]]集成进行多渠道通知。

## Key Claims

- 监控引擎 (`MonitoringEngine`) 仅[[交易时间]]执行检查，通过[[分时线服务]]缓存日内价格数据
- 实时价格获取优先级：DB秒级快照 → [[Tushare]] → [[AKShare]] → DB日K线收盘价兜底
- 支持价格阈值（绝对价格、百分比）、[[技术指标]]告警（[[RSI]]、[[MA]]、[[MACD]]）、[[AI智能盯盘]]
- 触发告警后自动停用监控，通知失败时最多重试2次并重新激活
- 支持多规则[[风险预警]]（价格、波动率、成交量、技术面、基本面）
- 数据模型涵盖 [[monitored_stocks]]、[[price_history]]、[[notifications]]、[[ai_decisions]]、[[intraday_points]]、[[trade_records]] 六张表

## Key Quotes

> "价格监控与预警系统是平台的实时盯盘与风控工具，支持用户对股票设置价格监控、技术指标告警、AI 智能盯盘和多规则风险预警。"

> "监控引擎仅在交易时间执行检查，触发告警后自动停用监控并生成交易计划。"

## Connections

- [[MainFundSelection|主力选股系统]] — 监控股票来源于主力选股系统的选股结果
- [[通知与消息系统]] — 告警触发后通过通知系统发送邮件/短信/站内信
- [[分时线服务]] — 分时线服务提供实时价格缓存
- [[AI智能盯盘]] — AI智能盯盘模块结合市场环境综合判断
- [[风险预警]] — 多维度风险预警系统
- [[Backtesting|回测]] — 监控触发决策可纳入回测验证
- [[Tushare]] — 实时行情数据源之一
- [[AKShare]] — 实时行情数据源之一
- [[DataPipeline|数据管道]] — 分时数据写入和缓存机制
- [[RiskManagement|风险管理]] — 与平台的[[风险管理]]紧密集成

## Contradictions

None detected with existing wiki content.
