---
title: "ResizeObserver"
type: entity
tags: [browser, api, layout]
sources: [root-layout-main-application-layout-component]
last_updated: 2026-05-14
---

[[ResizeObserver]] is a browser API used in [[RootLayout]] to dynamically measure the height of the [[AlertBanner]] component. The observer re-measures whenever dependencies change (`isOnline`, `updateAvailable`, `canInstall`, `apiConnected`, `alertCount`), and the measured `bannerHeight` is applied as `paddingTop` to the main content area to prevent content overlap.