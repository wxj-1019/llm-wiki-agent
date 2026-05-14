---
title: "Easing Function"
type: concept
tags: [animation, mathematics, frontend]
sources: [usecountup-animated-counter-hook]
last_updated: 2026-05-14
---

## Summary
An easing function maps animation progress (0 to 1) to a transformed value, controlling the perceived speed of an animation. Common types include linear, ease-in, ease-out, and ease-in-out.

## In LLM Wiki Viewer
The [[useCountUp]] hook implements cubic ease-out (`1 - (1 - t)^3`) for animated counter transitions. This choice provides a natural deceleration that feels polished.

## Connections
- [[CubicEaseOut]] — specific easing used by useCountUp
- [[useCountUp]] — consumer
- [[RequestAnimationFrame]] — animation driver