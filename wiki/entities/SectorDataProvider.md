---
title: "SectorDataProvider"
type: entity
tags: [data-provider, sector, a-share]
sources: [sector-strategy-and-market-analysis]
last_updated: 2026-05-09
---

# SectorDataProvider

板块数据采集核心服务，位于 `app/services/sector/sector_data_provider.py`，是[[板块策略与大盘分析]]模块的数据层基础。

## 功能
- 提供行业/概念列表与行情（主源：新浪/AKShare，备用：同花顺→东方财富）
- 提供板块成分股、北向资金、新闻、K线（主源：Tushare，备用：AKShare/申万/东方财富/新浪）
- 资金流向数据（主源：同花顺，备用：东方财富）
- 全市场实时行情（主源：新浪，备用：Tushare daily_basic→东方财富）
- 实时涨跌刷新（主源：Tushare rt_k，备用：ts.realtime_quote爬虫→新浪）

## 设计特点
- 全局并发限制：`GLOBAL_SECTOR_SEMAPHORE = asyncio.Semaphore(3)`
- 失败源自动记忆（`_failed_sources` set），避免重复尝试
- 代理禁用与防风控检测（检查HTML错误页）
- 内置申万行业映射`sw_index_map`覆盖31个一级行业及细分行业

## Connections
- [[MainFundSelection]] — 为主力选股系统提供板块级别中观数据
- [[SectorRotation]] — 板块资金流向数据驱动轮动策略分析
- [[MoneyFlowStrategy]] — 资金流策略依赖本服务的资金流向数据