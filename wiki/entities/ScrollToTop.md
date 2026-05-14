---
title: "ScrollToTop"
type: entity
tags: [frontend, react, component, navigation, accessibility]
sources: [RootLayoutComponent.md, root-layout-main-application-layout-component.md]
---

# ScrollToTop

`ScrollToTop` is a React component rendered as part of the [[RootLayout]] in the [[LLMWikiViewer]] frontend. Its primary purpose is to provide a visible, clickable button that scrolls the user back to the top of the page, typically appearing after the user has scrolled down a significant distance. This component enhances user experience by reducing friction when navigating long content pages, and it also aids accessibility by offering an alternative to keyboard or manual scrolling. In the broader context of the wiki, `ScrollToTop` is associated with the top-level layout orchestration, and it is listed alongside other utility components such as [[ToastContainer]], [[AlertBanner]], and [[PageSkeleton]]. It does not manage state directly but is managed by the `RootLayout` component, which tracks scroll position and controls the button's visibility. As a passive UI element, `ScrollToTop` is typically imported from a shared components directory and is not responsible for any data fetching, routing, or business logic.