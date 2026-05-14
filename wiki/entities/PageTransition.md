---
title: "PageTransition"
type: entity
tags: [frontend, animation, framer-motion]
sources: [root-layout-main-application-layout-component]
last_updated: 2026-05-14
---

[[PageTransition]] is an internal component of [[RootLayout]] that wraps [[AnimatePresence]] and applies route-specific animations via the `getPageAnimation()` function. Graph/mindmap pages use opacity + scale animation, deeper pages (upload/chat/settings/status/mcp/skills/dashboard/crawler/timeline) use opacity + horizontal slide, and all other pages use opacity + vertical slide.