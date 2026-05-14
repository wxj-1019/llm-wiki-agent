---
title: "DeepMerge"
type: code_func
tags: [typescript, utility]
sources: [system-config-store-zustand-manager]
last_updated: 2026-05-14
---

# deepMerge

Recursive object merge with prototype pollution protection.

## Signature

```typescript
function deepMerge(target: Record<string, unknown>, source: unknown): Record<string, unknown>
```

## Parameters
- `target` — the base object to merge into
- `source` — the source object whose keys will override `target`'s

## Returns
- A new merged object (original `target` is not mutated; spread copy is used at top level)

## Behavior
- For nested objects (both sides are non-array objects), recurses into them
- For primitive values or arrays, source value directly overrides target
- Skips keys in `DANGEROUS_KEYS` set (`__proto__`, `constructor`, `prototype`)
- Source arrays are treated as atomic values (replaced, not merged)

## Example

```typescript
const merged = deepMerge(
  { a: 1, b: { c: 2 } },
  { b: { d: 3 } }
);
// Result: { a: 1, b: { c: 2, d: 3 } }
```

## Related
- [[useConfigStore]] — uses this function in `setConfig` and `loadFromStorage`
- [[ConfigPersistencePattern]] — the pattern this utility enables
