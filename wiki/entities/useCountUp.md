---
title: "useCountUp"
type: entity
tags: [hooks, react, typescript, animation, counter, timer]
sources: [UploadPage.md, UseReducedMotionHook.md, notification-store-zustand-notification-store.md, uploadpage-file-upload-component.md, usereducedmotion-os-level-reduced-motion-preference-hook.md]
---

# useCountUp

`useCountUp` is a custom React hook within the LLMWikiViewer frontend codebase, used to animate numeric values from a starting point to an ending point over a specified duration. It is typically employed to provide a polished, progressive visual effect for metrics such as file upload progress, notification counts, or elapsed timers. The hook manages its own interval-based incrementation internally, updating state at regular frames to create a smooth counting animation. While not explicitly documented across all current source pages, its presence is inferred from the pattern of animated counters seen in components like `UploadPage`, where `uploadProgress` and various numeric status indicators are displayed. The hook is designed to be accessible and responsive to user preferences; notably, it respects the output of the `useReducedMotion` hook. When `useReducedMotion` returns `true`, `useCountUp` should skip its animation sequence and instantly jump to the target value, ensuring that users with OS-level "Reduce Motion" enabled do not experience unnecessary or potentially distracting animations. This integration makes `useCountUp` a key player in the frontend's accessibility strategy, bridging real-time data display with smooth, user-respecting motion design. The hook likely accepts parameters including `end`, `duration`, and an optional `start` value, returning the current animated count alongside a `reset` or `start` control function for imperative control.