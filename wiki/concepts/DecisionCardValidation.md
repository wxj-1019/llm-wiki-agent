---
title: "Decision Card Validation"
type: concept
tags: [ai, decision, validation]
sources: [ai-intelligent-analysis-system]
last_updated: 2026-05-09
---

## Summary

决策卡片校验逻辑（Decision Card Validation）位于 `app/services/ai/ai_agents_service.py`，是[[ai-intelligent-analysis-system|AI智能分析系统]]中防止AI幻觉导致的矛盾数据的关键机制。对于多头（BUY/HOLD）：要求 `stop_loss < current_price < target_price <= take_profit`；对于空头（SELL）：要求 `take_profit <= target_price < current_price < stop_loss`。若逻辑矛盾，自动按默认比例重置（如目标价 = current_price × 1.10）。

## Related Concepts

- [[ThreeStageAnalysisPipeline]] — 三阶段流水线
- [[MultiAgentCoordinationArchitecture]] — 多智能体架构
- [[RiskManagement]] — 风险管理