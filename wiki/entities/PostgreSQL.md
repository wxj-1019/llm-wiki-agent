---
title: "PostgreSQL"
type: entity
tags: []
sources: [data-model-overview]
last_updated: 2026-05-09
---

# PostgreSQL

PostgreSQL 是 [[MainFundSelection|主力选股系统]] 的底层数据库，采用 Schema 隔离策略（public, stock_analysis, monitoring, portfolio, longhubang, sector_strategy, user_profiles）实现业务领域划分和权限管理。

## 核心技术特征（来自数据模型文档）

- Schema 隔离：每个业务领域独立 Schema
- JSON/JSONB 数据类型：存储灵活的分析结果、配置和快照
- 自增 Integer 主键
- 统一时间戳（created_at / updated_at）
- 软删除策略
- 级联清理

相关页面：[[data-model-overview|数据模型总览]]、[[MainFundSelection]]