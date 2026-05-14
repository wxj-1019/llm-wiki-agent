---
title: "SpeechSynthesisUtterance"
type: entity
tags: [browser-api, speech-synthesis, tts]
sources: [usespeechsynthesis-browser-tts-hook]
last_updated: 2026-05-14
---

## Summary
`SpeechSynthesisUtterance` is the core Web Speech API interface representing a speech request. It contains the content to be spoken and settings for voice, rate, pitch, and volume. The [[useSpeechSynthesis]] hook manages its lifecycle — creating new utterances for playback, attaching `onend`/`onerror`/`onpause` callbacks, and recreating on rate change while playing.

## Connections
- [[useSpeechSynthesis]] — primary consumer; manages utterance lifecycle
- [[useJarvisMood]] — potential consumer for [[JARVIS]] TTS output
- [[SSEEventStreamPattern]] — streaming text consumed by utterance
