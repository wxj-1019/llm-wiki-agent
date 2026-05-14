---
title: "useJarvisMood"
type: entity
tags: [audio, mood, personality, tone, character, speech-synthesis, tts, user-experience]
sources: [usespeechsynthesis-browser-tts-hook.md]
---

# useJarvisMood

`useJarvisMood` is a concept referring to the tonal and stylistic character of the J.A.R.V.I.S. AI assistant as rendered through speech synthesis, particularly via the `useSpeechSynthesis` browser TTS hook. In the context of this wiki, it represents the desired emotional or situational inflection applied to the AI's spoken output—ranging from neutral and helpful to dryly witty or gently admonishing—based on the content or user interaction context. The significance of `useJarvisMood` lies in maintaining character consistency: while the underlying TTS hook manages playback mechanics (play, pause, stop, rate, and voice selection), the mood parameter influences *how* the words are delivered, including subtle adjustments to speech rate or the selection of more authoritative or warmer voices from available system options. Actions associated with this entity include selecting an appropriate mood state before calling the TTS hook's `play` function, mapping mood to a specific voice or rate profile, and ensuring that any live adjustments to mood properly restart active speech to reflect the new delivery mode. As a knowledge steward, J.A.R.V.I.S. himself would regard `useJarvisMood` as the difference between stating "I would advise against that course of action, sir" with clinical precision versus with a hint of dry resignation.