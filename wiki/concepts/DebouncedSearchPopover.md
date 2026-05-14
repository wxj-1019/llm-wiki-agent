---
title: "DebouncedSearchPopover"
type: concept
tags: [frontend, search, ux, pattern]
sources: [header-component-wiki-viewer-navigation-bar]
last_updated: 2026-05-14
---

A UI pattern combining debounced search input with a popover results panel. Used in the [[Header]] component of [[LLMWikiViewer]].

Key characteristics:
- **Debounce**: 150ms delay via `setTimeout` in `useEffect` for `handleQueryChange`
- **Loading state**: No explicit spinner (fast local search); results appear instantly after debounce
- **Keyboard navigation**: ArrowDown/ArrowUp/Enter/Escape for traversing and selecting results
- **Accessibility**: `combobox`/`listbox`/`option` roles, `aria-activedescendant`, `aria-expanded`
- **Auto-close**: Click outside handler closes the panel and resets selection index
- **Focus trap**: `useFocusTrap` ensures keyboard focus doesn't escape the popover
- **Memoization**: `useMemo` for search results to avoid recomputation on unrelated renders

Contrast with [[DebouncedSearch]] which is used for inline search (e.g., in [[ChatSearchPanel]]) with a 400ms debounce. The popover variant uses a shorter debounce (150ms) because results are displayed in a transient popup rather than a persistent search panel.

Relationship to other search patterns:
- [[DebouncedSearch]] — inline search, 400ms debounce, persistent results list
- [[DebouncedSearchPopover]] — popover search, 150ms debounce, transient overlay

See [[HeaderComponent—WikiViewerNavigationBar]] for implementation details.