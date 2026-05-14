---
title: "useReducedMotion — OS-Level Reduced Motion Preference Hook"
type: source
tags: [frontend, typescript, react, hook, accessibility, reduced-motion, a11y]
date: 2026-05-14
source_file: useReducedMotion.ts
---

## Summary
The `useReducedMotion` hook (`useReducedMotion.ts`) provides a React hook that detects the user's OS-level "Reduce Motion" accessibility preference via `window.matchMedia('(prefers-reduced-motion: reduce)')`. It lazily initializes from the browser API, reactively updates when the user toggles the setting at the OS level, and cleans up its event listener on unmount. This hook is essential for building accessible, battery-friendly UIs that respect user disability preferences, particularly relevant for animating components in the [[LLMWikiViewer]] frontend.

## Key Claims
- **Lazy initialization from `matchMedia`**: Uses `useState(() => window.matchMedia(...).matches)` for accurate initial state, with SSR guard (`typeof window === 'undefined'`).
- **Reactive to OS-level changes**: Registers a `change` listener on the `MediaQueryList` object, updating state when the user changes their reduced motion preference at the OS level.
- **Clean teardown**: The `useEffect` cleanup removes the `change` event listener to prevent memory leaks and stale callbacks.
- **Zero dependencies beyond React**: Only imports `useState` and `useEffect`.
- **SSR-safe**: Returns `false` when `window` is undefined, preventing crashes during server-side rendering.

## Key Quotes
> "`const [reduced, setReduced] = useState(() => { if (typeof window === 'undefined') return false; return window.matchMedia('(prefers-reduced-motion: reduce)').matches; });`" — SSR-safe lazy initialization with OS media query
> "`const handler = (e: MediaQueryListEvent) => setReduced(e.matches); mql.addEventListener('change', handler);`" — reactive OS preference change listener
> "`return () => mql.removeEventListener('change', handler);`" — cleanup pattern

## Connections
- [[RootLayout]] — consumer for disabling frame animations when the user requests reduced motion
- [[Header]] — potential consumer for disabling slide/glassy animations
- [[useCountUp]] — the animated counter hook could check this to skip animation
- [[useToast]] — toast slide-in animation should respect this setting
- [[PageTransition]] — page transition animations should be disabled or simplified
- [[GraphPage]] — physics-based graph animations should respect reduced motion
- [[CommandPalette]] — modal open/close animations
- [[AnimatePresence]] — framer-motion presence animations should respect the preference
- [[LazyLoading]] — progress bar animation
- [[SmartScrollRestoration]] — scroll behavior animations

## Contradictions
- None identified.

---
## [2026-05-14] ingest | useReducedMotion — OS-Level Reduced Motion Preference Hook

Added source. Key claims: SSR-safe `prefers-reduced-motion` React hook with `matchMedia` reactive listener and clean teardown. Connects to [[LLMWikiViewer]] animating components ([[RootLayout]], [[GraphPage]], [[PageTransition]], [[Header]], [[useCountUp]], [[useToast]], [[CommandPalette]], [[AnimatePresence]], [[LazyLoading]], [[SmartScrollRestoration]]).