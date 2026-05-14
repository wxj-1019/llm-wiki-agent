---
title: "useCountUp"
type: code_func
tags: [frontend, typescript, react, hook, animation]
sources: [usecountup-animated-counter-hook]
last_updated: 2026-05-14
---

## Signature
```typescript
export function useCountUp(target: number, duration = 600): number
```

## Purpose
Animated counter hook that smoothly transitions from the current displayed value to a target number using [[CubicEaseOut]] easing. Handles mid-animation target changes gracefully.

## Parameters
- `target`: number — The destination value to animate toward.
- `duration`: number (default 600) — Animation duration in milliseconds.

## Returns
- `number` — The current animated integer value, suitable for rendering directly in JSX.

## Implementation Details
- Uses [[useState]] to hold the animated value.
- Uses [[useRef]] (`fromRef`, `toRef`, `startRef`) to track animation state across renders without causing re-renders.
- On `target` change: captures current `value` as `fromRef.current`, updates `toRef.current`, resets `startRef.current` to `null` for a seamless restart.
- [[useEffect]] drives a [[RequestAnimationFrame]] loop: computes progress `t` from elapsed time, applies cubic ease-out `1 - (1-t)^3`, updates state with `Math.round(...)`. Cancels RAF on cleanup.
- Uses `eslint-disable-next-line react-hooks/exhaustive-deps` to avoid unnecessary effect re-runs on `value` changes.

## Connections
- [[GraphPage]] — potential consumer for node/edge count animation
- [[Header]] — potential consumer for animated notification badges
- [[UseDebounce]] — complementary pattern (debounce delays, useCountUp eases)