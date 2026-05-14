---
title: "LLMModelCost"
type: code_module
tags: [llm, cost]
sources: [shared-llm-module]
last_updated: 2026-05-14
---

# LLMModelCost

**Location:** `tools/shared/llm.py`, line 192

**Purpose:** Module-level dictionary mapping model identifiers to per-1K-token costs.

Type: `dict[str, tuple[float, float]]` where each value is `(input_cost_per_1K, output_cost_per_1K)`.

Used by [[LLMBudgetTracker]] to compute per-request costs.

Covered models: deepseek-chat, deepseek-coder, claude-3-5-sonnet, claude-3-5-haiku, gpt-4o, gpt-4o-mini, gpt-3.5-turbo, gemini-2.0-flash.