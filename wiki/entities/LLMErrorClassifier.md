---
title: "LLMErrorClassifier"
type: entity
tags: [llm, utility, error-handling]
sources: [shared-llm-module]
last_updated: 2026-05-14
---

**LLMErrorClassifier** is a static error classification utility in the [[shared-llm-module|Shared LLM Module]]. It categorizes LLM API errors to inform retry and circuit breaker behavior.

- **Transient errors** (retryable): HTTP 429, 500, 502, 503, 504, `ConnectionError`, `Timeout`, `ConnectionResetError`
- **Permanent errors**: HTTP 400, 401, 403, 404
- **Method**: `classify(error)` returns `"transient"`, `"permanent"`, or `"unknown"`
- **Integration**: [[LLMCircuitBreaker]] uses this to decide whether to count a failure; [[call_llm]] uses it to decide whether to retry