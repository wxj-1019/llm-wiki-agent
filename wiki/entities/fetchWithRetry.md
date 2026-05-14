---
title: "fetchWithRetry"
type: entity
tags: [typescript, utility, network]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

**fetchWithRetry** is a TypeScript utility function that wraps the browser `fetch` API with configurable retry logic, timeout, and retry delay. It is used by [[useConfigStore]] for all network calls (health check, backend sync).

### Usage
```typescript
fetchWithRetry(url, { timeoutMs: 3000, retries: 1, retryDelayMs: 500 })
```

### Related
- [[useConfigStore]] — the store that uses this utility
- [[SystemConfig]] — the configuration synced via this utility
