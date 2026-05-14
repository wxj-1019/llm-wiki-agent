---
title: "LLMUnavailableError"
type: code_class
tags: [llm, error]
sources: [shared-llm-module]
last_updated: 2026-05-14
---

# LLMUnavailableError

**Location:** `tools/shared/llm.py`, line 58

**Purpose:** Custom exception raised when LLM backend is unavailable (circuit breaker open or daily budget exceeded).

Extends `Exception`.

Raised by:
- [[LLMCircuitBreaker.check]] when circuit is OPEN and cooldown hasn't expired
- [[LLMBudgetTracker.check_budget]] when daily budget is exceeded