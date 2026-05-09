---
title: "MarketMapTreemap"
type: concept
tags: [visualization, treemap, market-data]
sources: [sector-strategy-and-market-analysis]
last_updated: 2026-05-09
---

# MarketMapTreemap

大盘云图可视化概念，在[[板块策略与大盘分析]]模块中实现为基于Treemap的交互式热力图，展示个股和板块的涨跌幅及市值分布。

## 核心设计
- **双表机制**：`MarketMapRaw`（原始数据）+ `MarketMapPublished`（发布对照表）
- **版本管理**：每次刷新递增版本号，旧版本标记`deprecated`
- **数据类型**：`tushare_base` / `sina_realtime` / `mixed` / `price_refresh`
- **缓存策略**：Redis（TTL可配置）→ DB（PostgreSQL持久化）→ 返回初始化中状态
- **数据源降级链**：Tushare→申万行业→东方财富→新浪

## 定时任务
- 涨跌刷新：每5分钟（仅交易时间）
- 完整刷新：每日15:05收盘后
- 启动初始化：启动时立即触发

## Connections
- [[DataVisualization]] — Treemap可视化是金融数据展示的常用形式
- [[DataPipeline]] — 双表版本管理体现了数据管道的设计模式
- [[A股市场]] — 面向A股全市场个股的云图展示