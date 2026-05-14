---
title: "LoadFromStorage"
type: code_func
tags: [typescript, config, persistence]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

# loadFromStorage

Loads persisted config from localStorage and deep-merges with defaults.

## Signature

```typescript
function loadFromStorage(): SystemConfig
```

## Returns
- A [[SystemConfig]] object — either the stored config merged over defaults, or raw defaults if nothing stored

## Behavior
1. Calls `safeGet('wiki-system-config', isObject, {})` to retrieve stored config
2. Calls `deepMerge(DEFAULT_CONFIG, stored)` to merge stored overrides into defaults
3. Returns the merged result

## Related
- [[useConfigStore]] — calls this on initialization
- [[ConfigPersistencePattern]] — the persistence pattern
- [[SafeJson]] — safe localStorage utilities
- [[deepMerge]] — merge utility
