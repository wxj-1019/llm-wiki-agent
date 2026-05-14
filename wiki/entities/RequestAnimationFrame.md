---
title: "RequestAnimationFrame"
type: entity
tags: [frontend, javascript, api, animation, browser]
sources: [UseCountUpHook.md, usecountup-animated-counter-hook.md]
---

# RequestAnimationFrame

`RequestAnimationFrame` is a browser API that tells the rendering engine to execute a callback before the next repaint, providing the foundation for smooth, efficient JavaScript animations. Unlike `setTimeout` or `setInterval`, it synchronizes with the display's refresh rate — typically 60 frames per second — and automatically pauses when the tab is backgrounded, conserving system resources. Within this wiki, `RequestAnimationFrame` powers the animation loop in the `useCountUp` hook: each frame, the hook calculates the elapsed time since the animation started, applies a [[CubicEaseOut]] easing function, updates the displayed value via [[useState]], and then calls `RequestAnimationFrame` again to schedule the next frame. The API also passes a high-resolution timestamp to the callback, which the hook uses rather than relying on `Date.now()` to ensure precise, drift-free timing — critical for the smooth deceleration effect described in the source. When the `target` prop changes mid-animation, the hook resets its start time reference (`fromRef`) to the current displayed value and restarts the `RequestAnimationFrame` loop, enabling graceful mid-sequence transitions without layout jank.