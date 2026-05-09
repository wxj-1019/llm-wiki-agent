---
title: "BehavioralCollectorPattern"
type: concept
tags: [system-design, data-collection]
sources: [user-profile-system]
last_updated: 2026-05-09
---

# BehavioralCollectorPattern

**行为收集器模式**是一种系统设计模式，通过多个并行的专用收集器分别采集不同维度的用户行为数据，然后汇总分析。

## Characteristics

- **并行执行**：各收集器独立运行，减少总执行时间
- **单维度聚焦**：每个收集器负责一个特定领域的数据采集
- **增量更新**：支持基于最近一次画像的增量数据更新
- **幂等性**：通过内存锁防止并发重复生成

## Example

[[user-profile-system]]实现5个并行收集器：StockAnalysisCollector、PortfolioCollector、SectorAnalysisCollector、FundSelectionCollector、LonghubangCollector。

## Connections

- [[UserProfiling]] — 收集器的数据输出目标
- [[DataPipeline]] — 收集器构成数据管道的源头