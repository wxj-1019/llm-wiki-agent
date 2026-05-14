---
title: "useCountUp — Animated Counter Hook with Cubic Ease-Out"
type: source
tags: [frontend, typescript, react, hook, animation]
date: 2026-05-14
source_file: useCountUp.ts
---

## Summary
The `useCountUp` hook (`useCountUp.ts`) provides an animated counter for the [[LLMWikiViewer]] frontend that smoothly eases from the current value to a target number using cubic ease-out interpolation. It handles mid-animation target changes gracefully by resetting the animation from the current displayed value.

## Key Claims
- **Cubic ease-out animation**: Uses the easing function `1 - (1 - t)^3` for smooth deceleration towards the target value, providing a natural "settling" feel.
- **Graceful mid-animation updates**: When `target` changes during an active animation, `fromRef` captures the current displayed value and `startRef` resets, creating a seamless transition without visual jumps.
- **Canvas-driven with [[RequestAnimationFrame]]**: Uses `requestAnimationFrame` for smooth 60fps updates; automatically cancels the animation frame on unmount or when `target`/`duration` changes.
- **Configurable duration**: Accepts a `duration` parameter (default 600ms) to control animation speed.
- **Return value**: Returns the current animated integer value (`number`), suitable for rendering directly in JSX.

## Key Quotes
> "Returns the current animated integer value (number)" — core return type
> "fromRef.current = value; toRef.current = target; startRef.current = null" — reset logic for mid-animation target change

## Connections
- [[UseDebounce]] — debounce pattern for delayed value updates; useCountUp is the inverse (smooth interpolation over time)
- [[GraphPage]] — count-up animations are suitable for displaying graph stats (node/edge counts) with visual polish
- [[Header]] — notification badge counts could use useCountUp for animated transitions
- [[useState]] — state management for animated value
- [[useRef]] — mutable refs for tracking start time, from/to values
- [[useEffect]] — effect lifecycle for animation frame management

## Contradictions
- None identified.