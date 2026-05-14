---
title: "LLMCircuitBreaker"
type: entity
tags: [llm, utility, resilience]
sources: [shared-llm-module]
last_updated: 2026-05-14
---

**LLMCircuitBreaker** is a per-model circuit breaker implementation in the [[shared-llm-module|Shared LLM Module]]. It implements a CLOSED → OPEN → HALF_OPEN → CLOSED state machine to prevent cascading failures from upstream LLM API outages.

- **Failure threshold**: Default 5 consecutive failures before opening
- **Cooldown**: Default 60 seconds before transitioning to HALF_OPEN
- **State persistence**: Persists to `state/circuit_breaker.json` with atomic file writes
- **Integration**: Used by [[call_llm]] before every request via `cb.check(model)`
- **Error classification**: Uses [[LLMErrorClassifier]] to distinguish transient (counted) vs permanent (ignored) errors

Key methods:
- `check(model)` — raises `LLMUnavailableError` if circuit is OPEN and cooldown hasn't expired
- `record_success(model)` — transitions HALF_OPEN → CLOSED
- `record_failure(model, error)` — increments counter, transitions to OPEN at threshold
- `get_status(model)` / `get_all_status()` — returns state info with cooldown_remaining