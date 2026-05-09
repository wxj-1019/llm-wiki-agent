---
title: "FourSourceDegradationChain"
type: concept
tags: [data-pipeline, high-availability, fallback]
sources: [sector-strategy-and-market-analysis, main-fund-selection-system-analysis]
last_updated: 2026-05-09
---

# FourSourceDegradationChain

四源降级链是[[板块策略与大盘分析]]模块采用的数据高可用策略，当主数据源不可用时自动降级到备用数据源。

## 大盘云图降级链
```
Tushare（行业分类+日线行情）
    ↓ 失败
申万行业（内置sw_index_map映射31个一级行业）
    ↓ 失败
东方财富（akshare）
    ↓ 失败
新浪（akshare）
```

## 说明
- 失败源自动记忆（`_failed_sources` set），避免重复尝试
- 代理禁用与防风控检测协同工作
- 在[[MainFundSelection|主力选股系统]]的数据管道中也有类似的多源降级策略

## Connections
- [[DataPipeline]] — 多源降级是数据管道鲁棒性的关键设计
- [[RiskManagement]] — 数据源故障是操作风险的一种
- [[A股市场]] — 针对A股数据源的中国特色降级策略