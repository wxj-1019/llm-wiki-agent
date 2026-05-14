---
title: "SmartScrollRestoration"
type: concept
tags: [frontend, routing, ux]
sources: [root-layout-main-application-layout-component]
last_updated: 2026-05-14
---

[[SmartScrollRestoration]] is a design pattern implemented in [[RootLayout]] where the component scrolls to top on route changes, but exempts detail pages (matching `^\/(s|e|c|y)\/`) from automatic scrolling. This allows [[PageDetailPage]] to implement its own scroll restoration logic for pages like sources, entities, concepts, and syntheses, preserving the user's scroll position when navigating back to a previously viewed detail page.