---
title: "AKShare"
type: entity
tags: [data-source, a-share, longhubang]
sources: [longhubang-analysis-system]
last_updated: 2026-05-09
---

**AKShare** 是一个开源的 A 股数据接口库，在[[longhubang-analysis-system|龙虎榜分析系统]]中作为主力数据源，通过 `stock_lhb_detail_em` 接口获取每日龙虎榜详情。与 [[Tushare]] 双数据源整合，互相补充，提高龙虎榜数据完整性。

## Connections
- [[Tushare]] — 互补数据源
- [[longhubang-analysis-system]] — 龙虎榜系统核心数据来源
- [[A股市场]] — 面向A股市场的数据接口