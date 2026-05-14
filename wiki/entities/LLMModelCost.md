---
title: "LLMModelCost"
type: entity
tags: [llm, cost, model]
sources: [shared-llm-module]
last_updated: 2026-05-14
---

**LLMModelCost** (defined as `MODEL_COST` in `tools/shared/llm.py`) is a dictionary mapping model identifiers to per-1K-token cost tuples `(input_cost, output_cost)`. Covers 10+ models including:

- `deepseek/deepseek-chat`: $0.00014 / $0.00028
- `deepseek/deepseek-coder`: $0.00014 / $0.00028
- `anthropic/claude-3-5-sonnet-latest`: $0.003 / $0.015
- `anthropic/claude-3-5-haiku-latest`: $0.001 / $0.005
- `openai/gpt-4o`: $0.0025 / $0.01
- `openai/gpt-4o-mini`: $0.00015 / $0.0006
- `openai/gpt-3.5-turbo`: $0.0005 / $0.0015
- `google/gemini-2.0-flash`: $0.0001 / $0.0004

Used by [[LLMBudgetTracker]] for cost calculation.