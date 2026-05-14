---
title: "DynamicBannerHeightMeasurement"
type: concept
tags: [frontend, layout, resize-observer]
sources: [root-layout-main-application-layout-component]
last_updated: 2026-05-14
---

[[DynamicBannerHeightMeasurement]] is a layout technique used in [[RootLayout]] where a [[ResizeObserver]] monitors the [[AlertBanner]] element and adjusts the main content area's `paddingTop` accordingly. This prevents content from being hidden behind the banner (which appears below the fixed [[Header]] and can change height). The observer re-subscribes whenever relevant state changes (`isOnline`, `updateAvailable`, `canInstall`, `apiConnected`, `alertCount`), ensuring accurate measurements even when banner content dynamically appears or disappears.