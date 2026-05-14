---
title: "RefreshCcw"
type: entity
tags: [lucide-react, icon, ui-component]
sources: [ErrorBoundary.md, errorboundary-route-error-handling-component.md]
---

# RefreshCcw

**RefreshCcw** is a Lucide React icon component representing a circular arrow symbol oriented counterclockwise, commonly used to indicate a refresh, reload, or retry action in user interfaces. In the context of the Personal LLM Wiki, RefreshCcw appears as an imported icon within the `ErrorBoundary` component (`ErrorBoundary.tsx`), where it is imported from the `lucide-react` library alongside `Home` and `AlertTriangle`. While the current source excerpts do not explicitly show its placement in the rendered output, RefreshCcw is typically rendered as a button or link that allows a user to attempt to reload the current route or retry a failed navigation after an error has been caught by the boundary. Its presence alongside `Home` (which likely navigates back to the root route) suggests that the error fallback UI provides the user with two corrective actions: returning to a safe starting point, or retrying the failed operation. As a Lucide icon, RefreshCcw follows the standard interface of receiving optional size, color, and stroke width props, and it contributes to the application's internationalized and accessible design, as the `ErrorBoundary` component also integrates with `react-i18next` for localized label text.