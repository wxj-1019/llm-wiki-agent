---
title: "AlertTriangle"
type: entity
tags: [icon, ui-element, lucide-react, error-state, warning]
sources: [ErrorBoundary.md, RootLayoutComponent.md, root-layout-main-application-layout-component.md]
---

# AlertTriangle

`AlertTriangle` is a Lucide React icon imported from the `lucide-react` library and used in the [[LLMWikiViewer]] frontend's [[ErrorBoundary]] component. It represents a warning or error state, rendered inside a centered fallback UI when a route-level error occurs. The icon is displayed within a decorative `div` with rounded styling, typically accompanied by an error message from [[useTranslation]] and recovery actions such as a "Return Home" button. As a visual indicator, `AlertTriangle` signals to the user that something has gone wrong in a non-critical, recoverable manner — distinct from a fatal crash. Its usage reinforces the application's commitment to graceful error handling and user guidance during unexpected states. The icon itself is rendered as an SVG element by the Lucide library and carries no custom props or logic beyond its default presentation.