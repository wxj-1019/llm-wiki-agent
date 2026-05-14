---
title: "LLMBudgetTracker"
type: code_class
tags: [llm, utility, cost]
sources: [shared-llm-module]
last_updated: 2026-05-14
---

# LLMBudgetTracker

**Location:** `tools/shared/llm.py`, line 205

**Purpose:** Per-model daily cost tracking with configurable budget enforcement.

## Constructor
`__init__(budget_usd: float = 10.0, state_file: Path | None = None)`

## Methods

### check_budget() -> None
- Checks if daily budget has been exceeded; raises `LLMUnavailableError` if so
- Auto-resets at midnight via `_check_daily_reset()`

### record_usage(model: str, prompt_tokens: int | None, completion_tokens: int | None, latency_ms: float) -> None
- Looks up cost per model from [[LLMModelCost]]
- Calculates cost = (prompt_tokens/1000 * input_cost) + (completion_tokens/1000 * output_cost)
- Checks budget after recording

### get_summary() -> dict
Returns dict: `{date, total_prompt_tokens, total_completion_tokens, total_cost_usd, budget_usd, models: {<model>: {tokens, cost, count, avg_latency_ms}}}`

## Internal Methods

### `_get_model_cost(model: str) -> tuple`
- Returns `(prompt_cost_per_1K, completion_cost_per_1K)` from [[LLMModelCost]]
- Returns `(0, 0)` for unknown models

### `_check_daily_reset() -> None`
- Compares stored `date` with `date.today()`
- Resets all counters if day changed

## State
Persisted to `state/budget_tracker.json` with atomic writes.
State format includes `date`, per-model usage stats, and total cost.