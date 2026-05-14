---
title: "SpeechSynthesisHook"
type: concept
tags: [react, hook, speech-synthesis, tts, pattern]
sources: [usespeechsynthesis-browser-tts-hook]
last_updated: 2026-05-14
---

## Summary
The SpeechSynthesis Hook pattern in React encapsulates the Web Speech Synthesis API into a declarative, stateful interface. Key design decisions include: using refs for mutable state (rate, voice) shared across callbacks to avoid stale closures; live restart of active speech when rate changes; filtering intentional cancel errors from actual failures; and clean teardown that cancels pending speech and removes event listeners.

## Connections
- [[useSpeechSynthesis]] — concrete implementation of this pattern
- [[DebouncePattern]] — both manage async side effects with cleanup
- [[SSEEventStreamPattern]] — potential to stream TTS incrementally
- [[CircuitBreakerPattern]] — error state management for crash recovery
