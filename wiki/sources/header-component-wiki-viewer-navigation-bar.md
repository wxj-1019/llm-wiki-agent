---
title: "Header Component — Wiki Viewer Navigation Bar"
type: source
tags: [frontend, typescript, react, navigation, header, search, theme]
date: 2026-05-14
source_file: Header.tsx
---

## Summary
The `Header` component (`Header.tsx`) is the fixed top navigation bar for the [[LLMWikiViewer]] frontend. It provides theme switching (light/system/dark), a popover search panel with keyboard navigation and debounced input, sidebar toggle, graph page link, SSE connection status indicator, language switcher, and notification dropdown — all with Apple-style glassmorphism design via Framer Motion animations.

## Key Claims
- **Search popover**: 150ms debounced search via `searchNodes()` from `@/lib/search`, limited to 6 results, with keyboard navigation (ArrowDown/ArrowUp/Enter/Escape), `aria-*` accessibility attributes (`combobox`, `listbox`, `option`), and auto-focus on open. Opens via `wiki:focus-search` custom event listener or by clicking the search button.
- **Global search shortcut**: `Ctrl+K` keyboard shortcut hint displayed in the search button (`kbd` element). Custom event listener for `wiki:focus-search` enables external components to trigger search.
- **Theme toggle**: Three-button segmented control (`[[Sun]]`/`[[Monitor]]`/`[[Moon]]`) for light/system/dark themes, stored in `useWikiStore` Zustand store via `setTheme()`. Active button highlighted with `bg-[var(--bg-primary)] text-apple-blue shadow-sm`.
- **Sidebar toggle**: Toggles sidebar collapse state via `toggleSidebar()` from Zustand store. Shows `[[Menu]]` icon when collapsed, `[[X]]` when expanded.
- **Connection status**: Small colored dot (`w-2 h-2 rounded-full`) showing SSE connection state from `connectionState` prop: green for `connected`, amber for `connecting`, red otherwise. Tooltips in Chinese.
- **Language switcher**: Uses [[AppleSelect]] component with [[SUPPORTED_LANGUAGES]] from `@/i18n`. Calls `i18n.changeLanguage()` on selection.
- **Notification dropdown**: `NotificationDropdown` component embedded next to status dot.
- **Graph link**: [[Network]] icon link to `/graph` route.
- **Apple glassmorphism styling**: `backdrop-blur-xl bg-[var(--bg-primary)]/75 border-b border-[var(--border-subtle)]` — consistent with design system of [[HomePage]], [[BrowsePage]], and other pages.
- **Focus trap**: `useFocusTrap` hook applied to search popover when open, preventing focus from escaping.
- **Accessibility**: All interactive elements have `aria-label`, `aria-expanded`, `aria-haspopup` where appropriate. Search input uses `combobox` role with `aria-controls`, `aria-activedescendant`, and `role="listbox"`/`role="option"` for results.
- **Memoized search results**: `useMemo` over `debouncedQuery` avoids recomputation on unrelated re-renders.

## Key Quotes
> No direct quotes; code-based source.

## Connections
- [[ChatPage]] — the Header provides the top navigation bar for all pages including ChatPage
- [[LanguageSwitcher]] — extracted inline component
- [[NotificationDropdown]] — embedded component for notifications
- [[AppleSelect]] — UI primitive used for language selection
- [[SUPPORTED_LANGUAGES]] — i18n language configuration
- [[useFocusTrap]] — accessibility hook
- [[useWikiStore]] — Zustand store for theme and sidebar state
- [[searchNodes]] — search utility from `@/lib/search`
- [[getPagePath]] — routing utility from `@/lib/wikilink`
- [[GraphPage]] — linked via `/graph` route
- [[HomePage]] — linked via `/` route
- [[useTranslation]] / [[i18next]] — internationalization
- [[FramerMotion]] — animation library for search popover entrance/exit

## Contradictions
- None identified.