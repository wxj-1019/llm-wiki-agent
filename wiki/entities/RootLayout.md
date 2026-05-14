---
title: "RootLayout"
type: entity
tags: [frontend, react, layout]
sources: [root-layout-main-application-layout-component]
last_updated: 2026-05-14
---

[[RootLayout]] is the main application shell component in the [[LLMWikiViewer]] frontend. It orchestrates the top-level layout: [[Header]], [[Sidebar]], [[CommandPalette]], [[IngestProgress]] bar, [[AlertBanner]], [[ToastContainer]], [[PageSkeleton]] loading state, [[ScrollToTop]] button, animated page transitions via [[FramerMotion]], and skip-to-content accessibility link. Integrates [[useNetworkStatus]], [[usePWAInstall]], [[useSWUpdate]], [[useKeyboardShortcuts]], [[useEventStream]], [[WikiStore]], and [[useNotificationStore]].