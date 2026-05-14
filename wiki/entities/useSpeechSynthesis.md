---
title: "useSpeechSynthesis"
type: entity
tags: [hook, react, web-speech-api, tts, accessibility]
sources: []
---

# useSpeechSynthesis

`useSpeechSynthesis` is a custom React hook that provides a programmatic interface to the Web Speech API's `SpeechSynthesis` functionality, enabling text-to-speech (TTS) capabilities within a React component tree. Its primary significance lies in abstracting the complexities of the browser's speech synthesis engine—such as voice selection, rate, pitch, volume control, utterance queuing, and cross-browser inconsistencies—into a clean, declarative API. Typically, the hook exposes a set of state properties (e.g., `speaking`, `supported`, `voices`, `error`) and action methods (e.g., `speak`, `cancel`, `pause`, `resume`), allowing developers to trigger spoken output from text, manage playback state, and retrieve available voices with minimal boilerplate. Associated best practices include checking browser support via the `supported` flag before rendering speech controls, handling user-gesture requirements for initial audio playback, and cleaning up queued utterances on component unmount to prevent memory leaks. In the context of this wiki, `useSpeechSynthesis` is categorized under hooks related to browser APIs and accessibility tooling.