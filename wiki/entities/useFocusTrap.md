---
title: "useFocusTrap"
type: entity
tags: [frontend, react, hook, accessibility]
sources: [usefocustrap-focus-trap-hook]
last_updated: 2026-05-14
---

# useFocusTrap

The `useFocusTrap` hook provides focus trapping for modal components in the [[LLMWikiViewer]] frontend. It is used by [[CommandPalette]], [[ChatSearchPanel]], and [[NotificationDropdown]] to ensure keyboard navigation stays within the active overlay.

## Key Features
- Activates focus trapping when the `active` parameter is `true`
- Restores focus to the previously focused element on deactivation
- Uses a comprehensive CSS selector for focusable elements including buttons, links, inputs, and contenteditables
- Returns a `containerRef` to attach to the container element

## Related Components
- [[CommandPalette]] — modal quick-action interface
- [[ChatSearchPanel]] — search dropdown panel
- [[NotificationDropdown]] — notification bell dropdown
- [[Sidebar]] — mobile responsive overlay