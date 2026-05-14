---
title: "useJarvisMood — J.A.R.V.I.S. Mood State Hook"
type: source
tags: [frontend, typescript, react, hook, jarvis, mood, animation]
date: 2026-05-14
source_file: useJarvisMood.ts
---

## Summary
The `useJarvisMood` hook (`useJarvisMood.ts`) provides a React hook for managing [[JARVIS|J.A.R.V.I.S.]] avatar mood state with a minimum thinking duration guard. It tracks the current mood (`idle`, `thinking`, etc.), enforces a configurable minimum time (default 1500ms) before transitioning away from `'thinking'` using deferred state updates, and toggles left/center docking position.

## Key Claims
- **Mood state management**: Maintains a reactive `mood` state of type `JarvisMood` (`idle`, `thinking`, etc.) with synchronous `moodRef` to avoid stale closures in callbacks.
- **Minimum thinking duration**: When transitioning *away* from `'thinking'`, the hook enforces that at least `minThinkingMs` (default 1500ms) have elapsed. If not, it schedules a deferred state update via `setTimeout`, canceling any previously pending transition.
- **Pending transition queue**: Uses `pendingMoodRef` to store the target mood for deferred transitions, and `timeoutRef` to manage the timeout lifecycle. Only one pending transition is kept at a time (new one cancels old).
- **Think start recording**: Timestamps the moment `'thinking'` is entered via `thinkingStartRef` for elapsed-time calculation.
- **Docking control**: Exposes `dockLeft` and `dockCenter` callbacks to toggle `isDockedLeft` boolean for avatar positioning.
- **Cleanup**: `useEffect` cleanup clears any pending timeout on unmount to prevent state updates on unmounted components.
- **Zero external dependencies**: Only imports `useState`, `useCallback`, `useRef`, and `useEffect` from React.

## Key Quotes
> "`if (currentMood === 'thinking' && nextMood !== 'thinking') { const elapsed = Date.now() - thinkingStartRef.current; const remaining = minThinkingMs - elapsed; if (remaining > 0) { ... timeoutRef.current = setTimeout(() => { ... setMoodState(nextMood); }, remaining); return; } }`" — Minimum thinking duration enforcement with deferred state update
> "`useEffect(() => { moodRef.current = mood; }, [mood]);`" — Synchronizing ref with state to avoid stale closures
> "`useEffect(() => { return () => { if (timeoutRef.current) { clearTimeout(timeoutRef.current); } }; }, []);`" — Unmount cleanup

## Connections
- [[JARVIS]] — the conceptual AI assistant this hook's mood visualizes
- [[JarvisPage]] — likely page/component that consumes this hook for avatar rendering
- [[JarvisAvatar]] — the component that receives the `JarvisMood` type and renders corresponding visual states
- [[useEffect]] — React hook for side-effect registration and cleanup
- [[useRef]] — React hook for mutable refs (moodRef, thinkingStartRef, pendingMoodRef, timeoutRef)
- [[useState]] — React hook for mood and docking state
- [[useCallback]] — React hook for memoized callbacks
- [[DebouncePattern]] — conceptually related pattern for deferred state updates

## Contradictions
- None identified.