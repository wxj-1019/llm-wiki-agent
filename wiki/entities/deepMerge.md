---
title: "deepMerge"
type: entity
tags: [typescript, utility]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

**deepMerge** is a recursive object merge utility function defined in `configStore.ts`. It deep-merges a source object into a target object, with protection against prototype pollution via a `DANGEROUS_KEYS` set that blocks `__proto__`, `constructor`, and `prototype` keys. Arrays are treated as atomic values (not merged).

### Usage
```typescript
const merged = deepMerge(defaultConfig, storedOverrides);
```

### Related
- [[useConfigStore]] — uses this function for state updates and config loading
- [[SystemConfig]] — the configuration type merged by this utility
