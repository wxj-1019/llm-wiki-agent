---
title: "ConfigurationManagement"
type: concept
tags: [infrastructure, devops]
sources: [task-scheduler-and-infrastructure]
last_updated: 2026-05-09
---

# ConfigurationManagement

配置管理是平台基础设施的安全基石。[[task-scheduler-and-infrastructure|任务调度与基础设施]]模块中的 `Settings` 基于 pydantic-settings，支持环境变量自动映射、多环境配置文件（`.env` / `.env.prod` / `.env.test`），敏感信息（密钥、Token）从环境变量读取，不提交到代码库。关键配置项包括 `SECRET_KEY`、`DATABASE_URL`、`REDIS_URL`、`AI_PROVIDER`、各 AI 平台 API Key 等。

## Key Claims

- 环境隔离：dev/prod/test 三环境
- 敏感信息仅从环境变量读取
- 优化方向：引入 Nacos/Apollo 配置中心实现热更新

## Related Pages

- [[task-scheduler-and-infrastructure|任务调度与基础设施]]
- [[王信杰]] — [[能源大数据平台]]涉及类似配置管理

## Connections

- [[Redis]] — REDIS_URL 配置项
- [[MainFundSelection]] — 选股系统的 AI 提供商配置
- [[Tushare]] — TUSHARE_TOKEN 配置项