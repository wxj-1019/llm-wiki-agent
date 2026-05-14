---
title: "Header — Main Navigation Bar Component"
type: code_module
tags: [frontend, typescript, react, navigation]
sources: [header-component-wiki-viewer-navigation-bar]
last_updated: 2026-05-14
---

## Signature
```tsx
export function Header({ connectionState }: { connectionState?: ConnectionState }): JSX.Element
```

## Purpose
Provides the top-level navigation bar for the [[LLMWikiViewer]] application, featuring theme switching, debounced search popover with keyboard navigation, sidebar toggle, graph link, SSE status indicator, language switcher, and notification dropdown.

## Parameters
- `connectionState?: ConnectionState` — optional SSE connection state (`connected`, `connecting`, or other) displayed as a colored status dot

## Key Internal State
- `searchOpen: boolean` — search popover visibility
- `query: string` — raw search input value
- `debouncedQuery: string` — debounced (150ms) search query
- `selectedIdx: number` — index of currently highlighted search result for keyboard navigation

## Key Functions
- `handleQueryChange(value: string)` — updates raw query, debounces before setting search query
- `handleResultClick(id: string)` — navigates to selected page via `navigate(getPagePath(node))`, closes search

## Imports
- `useState, useEffect, useRef, useMemo` from React
- `motion, AnimatePresence` from [[FramerMotion]]
- `Link, useNavigate` from `react-router-dom`
- `Search, Sun, Moon, Monitor, Network, Menu, X, Globe` from [[Lucide]] React
- `NotificationDropdown` from `./NotificationDropdown`
- `useTranslation` from `react-i18next` ([[i18next]])
- `useWikiStore` from `@/stores/wikiStore` (Zustand)
- `searchNodes` from `@/lib/search`
- `getPagePath` from `@/lib/wikilink`
- `SUPPORTED_LANGUAGES` from `@/i18n`
- `useFocusTrap` from `@/hooks/useFocusTrap`
- `AppleSelect` from `@/components/ui/AppleSelect`

## Related Code
- [[ChatPage]] — consumer of Header
- [[LanguageSwitcher]] — inline component within Header
- [[NotificationDropdown]] — embedded component

## Related Entities
- [[Header]] — entity page
- [[LanguageSwitcher]] — entity page

## Related Concepts
- [[DebouncedSearchPopover]] — search pattern used by this component