---
title: "Budget Tracking"
type: concept
tags: [llm, cost, monitoring]
sources: [shared-llm-module]
last_updated: 2026-05-14
---

**Budget Tracking** is a cost management concept implemented in the [[shared-llm-module|Shared LLM Module]] via [[LLMBudgetTracker]]. It provides per-day token and cost accounting to prevent unexpected LLM API charges.

## Key Features
- **Daily budget cap**: Configurable USD limit (default $10/day)
- **Per-model breakdown**: Tracks costs separately for each model
- **Auto-reset**: Counters automatically reset at midnight
- **State persistence**: Saved to `state/budget_tracker.json` with atomic writes
- **Integration**: [[call_llm]] calls `bt.check_budget()` before every request and `bt.record_usage()` after

## Cost Calculation
Uses [[LLMModelCost]] dictionary which maps model IDs to (input_cost_per_1K, output_cost_per_1K) tuples.