---
title: "SpeechSynthesis"
type: entity
tags: [browser-api, speech-synthesis, tts]
sources: [usespeechsynthesis-browser-tts-hook]
last_updated: 2026-05-14
---

## Summary
`window.speechSynthesis` is the browser's Web Speech Synthesis API singleton. The [[useSpeechSynthesis]] hook interacts with it via `speak()`, `pause()`, `resume()`, `cancel()`, and `getVoices()`. The hook also registers/unregisters the `onvoiceschanged` callback on this object for async voice loading.

## Connections
- [[useSpeechSynthesis]] — primary consumer
- [[SpeechSynthesisUtterance]] — the speech request object spoken by this controller
