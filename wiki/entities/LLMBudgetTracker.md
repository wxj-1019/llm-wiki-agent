---
title: "LLMBudgetTracker"
type: entity
tags: [llm, utility, cost]
sources: [shared-llm-module]
last_updated: 2026-05-14
---

**LLMBudgetTracker** is a daily token and cost tracking utility in the [[shared-llm-module|Shared LLM Module]]. It enforces a per-day budget cap to prevent unexpected cost overruns.

- **Budget**: Default $10/day, configurable via `budget_usd` parameter
- **State persistence**: Persists to `state/budget_tracker.json`
- **Auto-reset**: Automatically resets counters at midnight (new day detected via `date.today()`)
- **Cost model**: Uses [[LLM_MODEL_COST]] dictionary mapping model IDs to (input_cost, output_cost) per 1K tokens

Key methods:
- `check_budget()` — raises `LLMUnavailableError` if daily budget exceeded
- `record_usage(model, prompt_tokens, completion_tokens, latency_ms)` — logs usage and checks budget
- `get_summary()` — returns dict with `total_prompt_tokens`, `total_completion_tokens`, `total_cost_usd`, `budget_usd`, `models` (per-model breakdown)