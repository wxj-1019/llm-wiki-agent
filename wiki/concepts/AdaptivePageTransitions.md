---
title: "AdaptivePageTransitions"
type: concept
tags: [frontend, animation, routing, ux]
sources: [root-layout-main-application-layout-component]
last_updated: 2026-05-14
---

[[AdaptivePageTransitions]] is a design pattern implemented in [[RootLayout]] where page transition animations are selected based on the route path. Graph/mindmap pages get `opacity + scale` (zoom effect), deeper pages (upload/chat/settings/status/mcp/skills/dashboard/crawler/timeline) get `opacity + horizontal slide` (direction-aware), and all other pages get `opacity + vertical slide` (standard fade-up). This provides context-appropriate visual feedback during navigation.

[[AnimatePresence]] `mode="wait"` ensures exit animations complete before enter animations start, preventing visual conflicts.

### Related
- [[FramerMotion]]
- [[PageTransition]]
- [[AnimatePresence]]