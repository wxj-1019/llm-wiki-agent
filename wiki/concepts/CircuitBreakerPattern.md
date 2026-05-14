---
title: "Circuit Breaker Pattern"
type: concept
tags: [design-pattern, resilience, llm]
sources: [shared-llm-module]
last_updated: 2026-05-14
---

The **Circuit Breaker Pattern** is a resilience design pattern implemented in the [[shared-llm-module|Shared LLM Module]] via [[LLMCircuitBreaker]]. It prevents cascading failures by monitoring consecutive failures and temporarily blocking requests to a failing service.

## States
1. **CLOSED**: Normal operation — requests pass through
2. **OPEN**: Failures exceed threshold — requests are blocked immediately
3. **HALF_OPEN**: After cooldown — a single test request is allowed
   - If successful → transitions back to CLOSED
   - If failed → transitions back to OPEN

## Application
- Used per LLM model to isolate failures (e.g., Claude outage doesn't affect Gemini requests)
- State persisted to disk for resilience across restarts
- Integrated with [[LLMErrorClassifier]] to only count transient (retryable) failures