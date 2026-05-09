---
title: "通知与消息系统"
type: source
tags: [notification, messaging, email, alerts, announcements]
date: 2026-05-09
source_file: raw/uploads/13_通知与消息系统.md
---

## Summary

通知与消息系统是一个整合邮件、短信、站内信三种渠道的统一用户触达平台，支持系统公告发布、价格监控告警、AI 交易计划推送等功能。所有通知持久化到数据库，提供投递状态追踪和失败重试机制，是平台的重要组成部分，与 [[MainFundSelection|主力选股系统]] 的监控和 AI 分析模块深度集成。

## Key Claims

- 统一通知入口 `NotificationService` 整合邮件、短信、站内信三种渠道，支持 AI 交易计划自动推送
- 邮件支持 HTML 富文本模板和 3 次指数退避重试机制
- 系统公告支持 Markdown 内容、置顶、分类筛选和分页查询
- 所有通知持久化到数据库，记录投递状态（sent/failed/pending）和失败原因
- 告警系统分为系统异常告警和监控告警两个层面，监控告警通过通知系统统一投递

## Key Quotes

> "通知与消息系统是平台的用户触达与沟通渠道，整合邮件、短信、站内信三种通知方式。" — 系统概述

> "所有通知持久化到数据库，支持投递状态追踪和失败重试。" — 系统概述

## Connections

- [[MainFundSelection|主力选股系统]] — 通知系统与选股系统的监控模块和 AI 分析模块深度集成，支持止盈止损提醒、价格告警和 AI 交易计划推送
- [[EventDriven|事件驱动]] — 通知系统的触发本质上是一种事件驱动架构
- [[DataPipeline|数据管道]] — 通知数据的持久化和投递状态追踪属于数据管道的下游环节
- [[AIMultiAgentStockAnalysis|AI多智能体股票分析]] — AI 交易计划推送是 AI 多智能体分析结果的分发渠道
- [[WencaiAPI]] — 问财 API 为监控股票提供实时数据，触发价格告警
- [[Backtesting|回测验证]] — 回测系统的结果同样可以通过通知系统推送

## Contradictions

None detected.
