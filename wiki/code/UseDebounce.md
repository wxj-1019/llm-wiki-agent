---
title: "useDebounce — Generic Debounce Hook"
type: code_func
tags: [frontend, react, hook, debounce]
sources: [usedebounce-debounce-hook-for-react]
last_updated: 2026-05-14
---

# useDebounce — Generic Debounce Hook

**File:** `useDebounce.ts`

**Signature:** `function useDebounce<T>(value: T, delayMs?: number): T`

A generic React hook that debounces a value by a configurable delay. Returns the debounced value that updates only after `delayMs` milliseconds of no changes.

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | `T` | required | The value to debounce |
| `delayMs` | `number` | `300` | Debounce delay in milliseconds |

## Returns

| Type | Description |
|------|-------------|
| `T` | The debounced value, updated only after `delayMs` ms of inactivity |

## Details

- Uses [[useState]] to store the debounced copy
- Uses [[useEffect]] with `setTimeout`/`clearTimeout` to debounce
- Cleans up timers on unmount to prevent state updates on unmounted components
- Dependencies: `[value, delayMs]` - properly resets timer when value or delay changes

## Usage

```typescript
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 500);
// debouncedSearch updates 500ms after last input change
```

## Related Code
- [[DebouncedSearch]] — uses this hook for search input debouncing
- [[DebouncedPersistence]] — similar pattern for localStorage persistence in [[useChat]]