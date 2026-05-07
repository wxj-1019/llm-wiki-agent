---
title: "AIMultiAgentStockAnalysis"
type: concept
tags: [ai-agent, multi-agent, finance, stock-analysis]
sources: [main-fund-selection-system-analysis]
last_updated: 2026-05-07
---

# AIMultiAgentStockAnalysis

[[AIAgent|AI多智能体]]在股票分析中的应用范式。在[[main-fund-selection-system-analysis|主力选股系统]]中，以6个AI角色的协作架构实现：5位专业分析师并行执行（资金流向分析师、行业板块分析师、财务基本面分析师、技术形态分析师、量化分析师），共享一个token_collector进行成本追踪；1位资深研究员汇总5位分析师的输出和策略提示，生成综合推荐。系统通过asyncio.Semaphore控制并发度，每位分析师有独立超时控制，资深研究员使用独立的熔断器与分析师隔离。推荐结果采用"优先推荐"和"谨慎参考"双轨制，当AI推荐数量不足时使用量化回填机制。