---
title: "UserProfileSystem"
type: entity
tags: [user-profile, platform-module]
sources: [user-profile-system]
last_updated: 2026-05-09
---

# UserProfileSystem

**用户画像系统**是[[MainFundSelection|主力选股系统]]平台的核心模块，负责用户行为分析与个性化服务。

## Key Features

- **5个并行收集器**采集5大行为维度数据（股票分析、投资组合、板块分析、主力选股、龙虎榜分析）
- **AI大模型画像**：使用[[DeepSeek]]、[[Qwen]]、[[Kimi]]、[[GLM]]等[[LLM]]生成用户画像
- **4大分析维度**：投资风格、投资偏好、行为特征、能力评估
- **关注股票管理**：自动同步分析≥3次的股票，支持CRUD操作
- **版本历史追踪**：每次生成保存快照，支持评分趋势查看

## Core Models

- **UserProfile** — 用户画像主表（投资风格/偏好/行为特征/能力评估评分）
- **ProfileUpdateHistory** — 画像更新历史快照
- **UserProfileTag** — AI生成标签列表（如"价值投资者"、"短线高手"）
- **UserFollowStock** — 关注股票表（含分组、备注、告警）

## Connections

- [[MainFundSelection]] — 数据依赖
- [[StockSelectionStrategy]] — 潜在推荐关联
- [[RiskManagement]] — 画像含风控评分