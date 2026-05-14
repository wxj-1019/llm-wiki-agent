---
title: LazyPage
type: entity
tags: [frontend, component, lazy-loading]
sources: [lazypage-component]
last_updated: 2026-05-14
---

# [[LazyPage]]

The `LazyPage` component is a [[React]] wrapper for lazy-loading route components in the [[LLMWikiViewer]] frontend. It wraps children in a [[Suspense]] boundary and shows an animated `PageLoader` fallback with a looping indeterminate progress bar (0%→70%→90%) built with [[FramerMotion]].

Related: [[RootLayout]], [[LazyLoadingStrategy]], [[router-configuration]], [[PageSkeleton]]