---
title: "JarvisAvatar"
type: entity
tags: [component, react, avatar, ui]
sources: [usejarvis-mood-jarvis-mood-state-hook]
last_updated: 2026-05-14
---

**JarvisAvatar** is a React component at `@/components/jarvis/JarvisAvatar` that renders [[JARVIS|J.A.R.V.I.S.]]' visual avatar state. It exports a `JarvisMood` type used by [[useJarvisMood]] to control the avatar's appearance (e.g., `idle`, `thinking`).

## Connections
- [[useJarvisMood]] — manages mood state consumed by this component
- [[JARVIS]] — the conceptual assistant the avatar represents
- [[JarvisPage]] — parent page that composes avatar and mood hook