---
title: "useBodyScrollLock"
type: code_func
file: useBodyScrollLock.ts
signature: "useBodyScrollLock(locked: boolean): void"
tags: [frontend, hook, scroll, accessibility]
---

# useBodyScrollLock

`useBodyScrollLock` is a [[React]] hook that locks `document.body` scroll by setting `overflow: 'hidden'` while the `locked` parameter is `true`. It saves the original overflow value and restores it on unlock or component unmount.

## Signature

```typescript
export function useBodyScrollLock(locked: boolean): void
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `locked`  | `boolean` | When `true`, body scroll is locked; when `false`, original overflow is restored |

### Returns

`void`

## Usage

```tsx
useBodyScrollLock(isModalOpen);
```

## Implementation Details

The hook uses a `useEffect` with `locked` as its sole dependency:
1. If `locked` is falsy, the effect returns early (no side effect)
2. Otherwise, saves `document.body.style.overflow` into a local variable
3. Sets `document.body.style.overflow = 'hidden'`
4. Returns a cleanup function that restores the original overflow

The cleanup function fires both when the component unmounts and when `locked` becomes `false`, ensuring scroll state is always properly restored.

## Connections
- [[useEffect]] — underlying React hook
- [[Header]] — mobile sidebar scenarios
- [[Sidebar]] — overlay mode scroll prevention
- [[CommandPalette]] — modal scroll locking
