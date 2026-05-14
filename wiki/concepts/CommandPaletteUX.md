---
title: "CommandPalette UX"
type: concept
tags: [ux, accessibility, command-palette, frontend]
sources: [command-palette-component]
last_updated: 2026-05-14
---

# CommandPalette UX

The CommandPalette UX pattern provides a keyboard-driven quick-action interface for navigating and searching the [[LLMWikiViewer]] wiki. It is triggered by `Cmd/Ctrl+K` and displays a modal overlay with search, navigation commands, recent/favorite pages, and all wiki graph nodes.

## Core Principles
- **Always accessible**: Global keyboard shortcut works from any page
- **Dual-mode display**: Empty query shows curated sections (static nav + recent + favorites); typed query shows filtered results
- **Keyboard-first navigation**: Arrow keys cycle through results, Enter selects, Escape closes
- **Visual hierarchy**: Results grouped under section separators (recent, favorites, search results)
- **Minimal friction**: Opens on the last known state, input is auto-focused, results are updated in real-time

## Accessibility Requirements
- Focus trapping within the modal
- Body scroll locking
- Full ARIA attributes (dialog, listbox, option, combobox, aria-selected, aria-autocomplete, aria-activedescendant)
- Keyboard navigation that mirrors cursor-based interaction

## Related Patterns
- [[DebouncedSearch]] — delayed search execution, contrasts with CommandPalette's instant filter
- [[Header]] search popover — simpler inline search vs CommandPalette's full modal