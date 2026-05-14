---
title: "call_llm"
type: code_func
tags: [llm, utility, function]
sources: [shared-llm-module]
last_updated: 2026-05-14
---

# call_llm

**Signature:** `call_llm(prompt: str, system: str = "", model: str | None = None, max_tokens: int = 4096, temperature: float | None = None, max_retries: int = 3, api_key: str = "") -> str`

Primary LLM invocation function used by all wiki tools ([[ingest.py]], [[query.py]], [[lint.py]], [[build_graph.py]], etc.).

## Parameters
- `prompt` — The user/assistant message content
- `system` — Optional system prompt (prepended to J.A.R.V.I.S. persona)
- `model` — Override model (falls back to `config/llm.yaml` then claude-3-5-sonnet-latest)
- `max_tokens` — Max completion tokens (default 4096)
- `temperature` — Optional temperature override
- `max_retries` — Retry count with exponential backoff (default 3)
- `api_key` — Optional API key override

## Behavior
1. Injects [[JARVIS]] system persona
2. Checks [[LLMCircuitBreaker]] before request
3. Checks [[LLMBudgetTracker]] before request
4. Calls `litellm.completion()` with exponential backoff retry (2^attempt seconds)
5. Records success/failure in circuit breaker and budget tracker
6. Logs detailed metrics (model, elapsed, prompt/completion tokens, latency)

## Returns
- LLM response text (empty string if content filter triggered)

## Raises
- `LLMUnavailableError` — if circuit breaker is OPEN or daily budget exceeded
- `RuntimeError` — if response has no choices (possible content filter)
- Last exception — if all retries exhausted