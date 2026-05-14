---
title: "useSpeechSynthesis — Browser TTS Hook for React"
type: source
tags: [frontend, typescript, react, hook, speech-synthesis, tts, accessibility]
date: 2026-05-14
source_file: useSpeechSynthesis.ts
---

## Summary
The `useSpeechSynthesis` hook (`useSpeechSynthesis.ts`) provides a React hook for the Web Speech Synthesis API (TTS). It manages play/pause/stop controls, dynamic rate adjustment (with live restart of active speech), voice selection from available system voices with automatic default detection, and clean teardown on unmount. Uses `useRef` for rate/voice synchronization to avoid stale closures in callbacks.

## Key Claims
- **Full playback lifecycle**: Exposes `play`, `pause`, `stop` controls with correct state management (`playing`, `paused` booleans). Resuming from paused state calls `synth.resume()` without creating a new utterance.
- **Live rate adjustment**: `setRate` restarts the utterance with the new rate when currently playing — the old utterance is cancelled and a new one created with the updated rate. Uses `rateRef` to access the latest rate without re-creating the callback.
- **Voice loading and default selection**: Loads available voices on mount via `synth.getVoices()`, registers an `onvoiceschanged` callback for async loading, and auto-selects the default system voice (or first available). Uses `voiceRef` to avoid stale closures.
- **Clean error handling**: On `utterance.onerror`, only resets state if the error is not `'canceled'` (which is fired intentionally when cancelling to apply new rate).
- **Clean teardown**: The `useEffect` cleanup calls `synth.cancel()` and clears `onvoiceschanged` to prevent memory leaks and stale callbacks.
- **Zero external dependencies**: Only imports `useState`, `useEffect`, `useCallback`, and `useRef` from React.

## Key Quotes
> "`if (paused && utteranceRef.current) { synth.resume(); setPlaying(true); setPaused(false); return; }`" — resume from paused state without creating new utterance
> "`if (playing) { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.rate = newRate; ... }`" — live rate restart pattern
> "`return () => { synth.cancel(); synth.onvoiceschanged = null; };`" — cleanup on unmount
> "`utterance.onerror = (event) => { if (event.error !== 'canceled') { ... } }`" — filter out intentional cancel errors

## Connections
- [[useJarvisMood]] — potential consumer for [[JARVIS]] avatar voice output
- [[Header]] — potential TTS controls integration in navigation
- [[ChatConversation]] — potential use for reading chat messages aloud
- [[ChatPage]] — potential TTS integration for accessibility
- [[SSEEventStreamPattern]] — consuming streaming text for TTS
- [[PWA]] — offline-capable TTS via browser Speech Synthesis API

## Contradictions
- None identified.
