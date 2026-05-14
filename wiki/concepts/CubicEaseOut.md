---
title: "Cubic Ease-Out"
type: concept
tags: [animation, easing, frontend]
sources: [usecountup-animated-counter-hook]
last_updated: 2026-05-14
---

## Summary
Cubic ease-out is an easing function that starts fast and decelerates smoothly to a stop, providing a natural "settling" animation feel. It is defined as `1 - (1 - t)^3` for `t` in [0, 1].

## Usage in LLM Wiki Viewer
The [[useCountUp]] hook uses cubic ease-out for animated number transitions (e.g., graph node/edge counts). The easing provides a polished visual experience without requiring external animation libraries.

## Connections
- [[RequestAnimationFrame]] — browser API used to drive the animation loop
- [[useCountUp]] — consumer of this easing function