---
title: "LLMErrorClassifier"
type: code_class
tags: [llm, utility, error-handling]
sources: [shared-llm-module]
last_updated: 2026-05-14
---

# LLMErrorClassifier

**Location:** `tools/shared/llm.py`, line 63

**Purpose:** Classify LLM errors as transient (retryable) or permanent (non-retryable) based on HTTP status code or exception type.

## Constants
- `TRANSIENT = {429, 500, 502, 503, 504}` — status codes for retryable errors
- `PERMANENT = {400, 401, 403, 404}` — status codes for non-retryable errors

## Methods

### classify(error: Exception) -> str
- Attempts to extract `status_code` from the exception or its `.response` attribute
- Returns `"transient"`, `"permanent"`, or `"unknown"`
- Also classifies `ConnectionError`, `Timeout`, `ConnectionResetError` as transient

## Usage
Used by [[LLMCircuitBreaker]] (permanent errors don't count toward circuit breaker threshold) and [[call_llm]] (transient errors trigger retry, permanent errors don't).