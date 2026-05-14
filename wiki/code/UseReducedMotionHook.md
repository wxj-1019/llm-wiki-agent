---
title: "How to get started with useReducedMotion"
type: code_func
tags: [hooks, react, typescript, accessibility, reduced-motion]
---

# `useReducedMotion()`

## Module
`useReducedMotion.ts` — React hook for detecting OS-level `prefers-reduced-motion` preference.

## Signature
```typescript
export function useReducedMotion(): boolean
```

## Purpose
Returns `true` if the user has enabled "Reduce Motion" at the OS level, `false` otherwise. Detects changes reactively.

## Parameters
None.

## Returns
- `boolean` — `true` when `(prefers-reduced-motion: reduce)` matches, `false` otherwise.

## Implementation Notes
- **SSR guard**: Returns `false` when `window` is undefined.
- **Lazy initialization**: Uses `useState` initializer function to avoid unnecessary `matchMedia` calls.
- **Reactive listener**: Attaches `change` event to `MediaQueryList` for live updates.
- **Cleanup**: Removes listener on unmount.
- **Zero dependencies** beyond `useState` and `useEffect`.

## Related Pages
- [[RootLayout]] — primary consumer for disabling frame animations
- [[Header]] — glassmorphism animation consumer
- [[useCountUp]] — animated counter, should check this hook
- [[useToast]] — toast slide-in, should check this hook
- [[PageTransition]] — page transitions, should respect reduced motion
- [[GraphPage]] — physics-based graph animations
- [[CommandPalette]] — modal open/close animations
- [[AnimatePresence]] — framer-motion presence wrapper
- [[LazyLoading]] — progress bar animation