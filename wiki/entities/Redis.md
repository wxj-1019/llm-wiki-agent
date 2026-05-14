---
title: "Redis"
type: entity
tags: [caching, database, nosql, infrastructure]
sources: [wangxinjie-backend-developer-resume, task-scheduler-and-infrastructure, stock-data-service, backtest-engine, user-auth-and-permission-system]
last_updated: 2026-05-12
---

# Redis

**Redis** — 高性能内存数据库，在平台中承担缓存、任务队列、限流、验证码存储等多种基础设施角色。

## 平台中的使用场景

### 缓存层
- **股票数据缓存**：[[StockKlineCacheService]] 与 Redis 形成双层缓存（前端 Redis + 后端 DB）
- **板块数据缓存**：[[大盘云图]] 的 Treemap 数据和板块概览通过 Redis 缓存，TTL 可配置
- **价格缓存**：[[持仓管理与组合分析]] 使用 Redis 缓存股票实时价格
- **AI 请求优化**：[[AIRequestOptimizer]] 通过 Redis 缓存 LLM 响应，减少重复 API 调用

### 任务队列
- **回测任务队列**：[[backtest-engine]] 使用 Redis Hash/List 存储异步回测任务，最大并发 3 个，7 天 TTL
- **定时任务调度**：[[APScheduler]] 通过 Redis 管理调度状态和任务锁

### 认证与安全
- **验证码服务**：[[用户与权限系统]] 基于 Redis 实现验证码冷却期、日限流和防暴力破解锁定
- **Token 管理**：JWT 黑名单和刷新令牌通过 Redis 管理

### 限流与监控
- **请求限流**：[[RateLimiting]] 的滑动窗口限流算法底层依赖 Redis
- **性能监控**：[[Prometheus]] 采集 Redis 的缓存命中率（cache_hit_ratio）指标

### 连接池管理
- [[ai-intelligent-analysis-system|AI智能分析系统]] 通过 Redis 连接池管理与 [[AsyncClientPool]] 的缓存协作
- [[StockDataCoordinator]] 统一数据源管理依赖 Redis 缓存层

## 王信杰项目经验

- **[[能源大数据平台]]**：Redis 集群支持 5000 QPS 并发，响应时间 <500ms，系统可用性 99.99%
- **[[慧公寓管理系统]]**：Spring Boot + Redis + MyBatis-Plus 技术栈，用于会话管理和数据缓存

## Connections
- [[王信杰]] — 技术栈中间件
- [[能源大数据平台]] — 使用 Redis 集群
- [[慧公寓管理系统]] — 使用 Redis
- [[CacheManagement]] — 缓存管理策略
- [[多层缓存策略]] — 多层缓存架构
- [[RateLimiting]] — 限流底层存储
- [[APScheduler]] — 调度状态管理