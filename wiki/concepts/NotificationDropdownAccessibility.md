---
title: "NotificationDropdownAccessibility"
type: concept
tags: [frontend, accessibility, dropdown, keyboard-navigation]
sources: [notification-dropdown-component]
last_updated: 2026-05-14
---

# NotificationDropdownAccessibility

A pattern for accessible notification bell dropdowns in React. Key principles:

- **Toggle button**: Uses `aria-expanded` and `aria-haspopup` to indicate dropdown state.
- **Focus trapping**: When open, [[useFocusTrap]] keeps keyboard focus inside the dropdown.
- **Backdrop click**: A `fixed inset-0 z-40` div handles click-to-close.
- **Outside click detection**: `useEffect` + `mousedown` listener on `dropdownRef`.
- **Auto mark-read**: `onMouseEnter` and `onFocus` triggers allow intuitive read tracking.

Used by [[NotificationDropdown]] in the [[LLMWikiViewer]] frontend.