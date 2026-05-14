---
title: "LLMCircuitBreaker"
type: code_class
tags: [llm, utility, resilience]
sources: [shared-llm-module]
last_updated: 2026-05-14
---

# LLMCircuitBreaker

**Location:** `tools/shared/llm.py`, line 88

**Purpose:** Per-model circuit breaker preventing cascading failures from upstream LLM API outages.

## Constants
- `CLOSED = "CLOSED"`
- `OPEN = "OPEN"`
- `HALF_OPEN = "HALF_OPEN"`

## Constructor
`__init__(failure_threshold: int = 5, cooldown_seconds: int = 60, state_file: Path | None = None)`

## Methods

### check(model: str) -> None
- Raises `LLMUnavailableError` if circuit is OPEN and cooldown hasn't expired
- Auto-transitions to HALF_OPEN if cooldown has expired

### record_success(model: str) -> None
- Transitions HALF_OPEN → CLOSED; resets consecutive_failures to 0

### record_failure(model: str, error: Exception) -> None
- Uses [[LLMErrorClassifier]] to classify error; permanent errors are ignored
- Increments consecutive_failures; transitions to OPEN at threshold
- Saves state after every change

### get_status(model: str) -> dict
Returns state info including `cooldown_remaining` if OPEN

### get_all_status() -> dict
Returns status for all tracked models

## State
Persisted to `state/circuit_breaker.json` with atomic `.tmp` + `replace()` pattern.
State format: `{"models": {"<model>": {"state": "CLOSED|OPEN|HALF_OPEN", "consecutive_failures": 0, "last_failure": null, "opened_at": null}}}`