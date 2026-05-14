---
title: "Shared LLM Module (tools/shared/llm.py)"
type: source
tags: [llm, python, utility, circuit-breaker, budget-tracking]
date: 2026-05-14
source_file: tools/shared/llm.py
---

## Summary
The `tools/shared/llm.py` module is the central LLM configuration and calling utility for the entire LLM Wiki toolchain. It provides a J.A.R.V.I.S.-persona integration, a configurable circuit breaker (`[[LLMCircuitBreaker]]`) for per-model failure handling, a budget tracker (`[[LLMBudgetTracker]]`) for cost control, an error classifier (`[[LLMErrorClassifier]]`), and a robust `[[call_llm]]` function with exponential backoff retry logic. All tools read their LLM config from `config/llm.yaml` through this module.

## Key Claims
- **Centralized config**: Loads LLM config from `config/llm.yaml` via `_load_llm_config()`, with fallback defaults for provider, model, API key, and API base.
- **J.A.R.V.I.S. persona**: The `_JARVIS_PERSONA` constant defines an AI butler character (polite, precise, understated with dry wit) that is injected as system context in every `call_llm()` invocation.
- **Circuit breaker pattern**: `[[LLMCircuitBreaker]]` implements a per-model state machine (CLOSED → OPEN → HALF_OPEN → CLOSED) that prevents cascading failures. Configured with a failure threshold (default 5) and cooldown (default 60s).
- **Error classification**: `[[LLMErrorClassifier]]` categorizes errors as `transient` (429, 500-504, ConnectionError, Timeout) or `permanent` (400-404) to inform retry and circuit breaker behavior.
- **Budget tracking**: `[[LLMBudgetTracker]]` tracks daily token usage and cost per model, with a configurable daily budget limit (

## Key Claims
- **Centralized config**: Loads LLM config from `config/llm.yaml` via `_load_llm_config()`, with fallback defaults for provider, model, API key, and API base.
- **J.A.R.V.I.S. persona**: The `_JARVIS_PERSONA` constant defines an AI butler character that is injected as system context.
- **Circuit breaker**: `[[LLMCircuitBreaker]]` implements per-model CLOSED → OPEN → HALF_OPEN → CLOSED state machine with configurable threshold (5) and cooldown (60s).
- **Error classification**: `[[LLMErrorClassifier]]` categorizes errors as `transient` (429, 5xx, connection errors) or `permanent` (4xx).
- **Budget tracking**: `[[LLMBudgetTracker]]` tracks daily token usage/cost per model with configurable daily budget limit.
- **Retry logic**: `[[call_llm]]` implements exponential backoff retry (2^attempt seconds) up to `max_retries` (default 3).
- **Cost database**: `MODEL_COST` dict maps model IDs to (input_cost_per_1K, output_cost_per_1K) tuples for 10+ models.
- **State persistence**: Both circuit breaker and budget tracker persist to JSON files in `state/` directory with atomic file writes.

## Key Quotes
> "You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), an AI butler and knowledge steward."
> "Circuit breaker OPEN for {model}. Retry in {remaining:.0f}s"

## Connections
- [[LLM]] (concept) — the abstract concept this module implements
- [[LLMCircuitBreaker]] (entity) — per-model circuit breaker implementation
- [[LLMBudgetTracker]] (entity) — daily cost tracking and enforcement
- [[LLMErrorClassifier]] (entity) — error type classification utility
- [[call_llm]] (function/code) — the primary API this module exposes
- [[_load_llm_config]] (function) — config loading from `config/llm.yaml`
- [[config/llm.yaml]] (source) — the gitignored configuration file all tools read
- [[IngestWorkflow]] (concept) — uses this module for LLM calls during ingest
- [[QueryTool]] (source) — uses this module's `call_llm` for answer synthesis
- [[LintTool]] (source) — uses this module for semantic analysis

## Key Code Components
- `call_llm()` — the primary callable that all tools use to invoke LLMs
- `LLMCircuitBreaker` — protects against cascading upstream failures
- `LLMBudgetTracker` — prevents unexpected cost overruns
- `LLMErrorClassifier` — ensures appropriate error handling

## Contradictions
- The source file at `tools/shared/llm.py` was just ingested; its `_JARVIS_PERSONA` is a new addition not previously reflected in other wiki pages. No contradictions with existing content.
