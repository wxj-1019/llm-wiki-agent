---
title: "useFocusTrap — Focus Trap Hook for React"
type: source
tags: [frontend, typescript, react, hook, accessibility, keyboard, focus]
date: 2026-05-14
source_file: useFocusTrap.ts
---

## Summary
The `useFocusTrap` hook (`useFocusTrap.ts`) provides a focus trapping utility for the [[LLMWikiViewer]] frontend. When activated, it restricts [[Tab]] key navigation to focusable elements within a container, remembers the previously focused element, and restores focus upon deactivation. This is essential for modal dialogs, popovers, and dropdowns to meet [[WCAG]] accessibility standards.

## Key Claims
- **Focus trapping on activation**: When `active` is `true`, the hook focuses the first focusable element inside the container and intercepts Tab/Shift+Tab keydown events to cycle focus within the container.
- **Focus restoration on deactivation**: The hook remembers `document.activeElement` before activation; the cleanup function restores focus to that element, preventing keyboard focus from being lost when a modal/popover closes.
- **Comprehensive focusable selector**: Uses a broad CSS selector matching buttons, anchor links, inputs, selects, textareas, non-negative tabindex elements, and contenteditable elements — all excluding disabled elements.
- **Edge case handling**: If no focusable elements exist or the container is missing, the handler silently returns without preventing tab navigation. If focus escapes the container via mouse, the next Tab press wraps back to the first/last element.
- **Zero dependencies beyond React**: Only imports `useEffect` and `useRef`.
- **Return value**: Returns `containerRef` (a `React.RefObject`), which the caller attaches to the container element via `ref={containerRef}`.

## Key Quotes
> "`const FOCUSABLE_SELECTOR = ['button:not([disabled])', 'a[href]', 'input:not([disabled])', ...].join(', ');`" — comprehensive focusable element selector
> "`if (e.key !== 'Tab' || !container) return;`" — early exit for non-tab keys
> "`if (previousFocusRef.current instanceof HTMLElement) { previousFocusRef.current.focus(); }`" — focus restoration on cleanup

## Connections
- [[CommandPalette]] — modal popover that requires focus trapping for keyboard accessibility
- [[ChatSearchPanel]] — dropdown search panel that should trap focus when open
- [[NotificationDropdown]] — dropdown component that benefits from focus trapping
- [[Sidebar]] — mobile responsive overlay should trap focus
- [[useEffect]] — React hook for side effect registration
- [[useRef]] — React hook for mutable refs
- [[CommandPaletteUX]] — the `useFocusTrap` concept underlies keyboard-navigable command palette UX
- [[accessibility]] — focus trapping is a core WCAG requirement for modals
- [[React]] — React framework dependency