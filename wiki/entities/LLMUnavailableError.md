---
title: "LLMUnavailableError"
type: entity
tags: [llm, error]
sources: [shared-llm-module]
last_updated: 2026-05-14
---

**LLMUnavailableError** is a custom exception raised by [[LLMCircuitBreaker]] and [[LLMBudgetTracker]] when the LLM backend is unavailable due to open circuit breaker or exceeded daily budget. Defined in the [[shared-llm-module|Shared LLM Module]].