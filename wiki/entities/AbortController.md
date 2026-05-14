---
title: "AbortController"
type: entity
tags: [web-api, abort, cancellation]
sources: [useagentchat-agent-execution-chat-hook]
last_updated: 2026-05-14
---

# AbortController

[[AbortController]] is a standard Web API used by [[useAgentChat]] to cancel in-flight SSE fetch requests when the user disconnects or starts a new execution. The hook stores a mutable reference via `abortRef`.

## Related
- [[useAgentChat]] — uses AbortController for cancellation
- [[SSEStreamProtocol]] — context of streaming requests