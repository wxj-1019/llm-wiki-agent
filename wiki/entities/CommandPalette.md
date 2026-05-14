---
title: "CommandPalette"
type: entity
tags: [frontend, component, command-palette, react]
sources: [command-palette-component]
last_updated: 2026-05-14
---

# CommandPalette

`CommandPalette` is a React component in the [[LLMWikiViewer]] frontend that provides a modal quick-action interface triggered by `Cmd/Ctrl+K`. It displays navigation shortcuts, recent pages, favorite pages, and searchable wiki graph nodes.

## Features
- **Keyboard shortcut**: `Cmd/Ctrl+K` to open/close, `Escape` to close, arrow keys + Enter to navigate/select
- **Dynamic commands**: Static navigation (Home, Browse, Search, Graph, Upload, Chat, Settings) + recent/favorite pages + all graph nodes
- **Search**: Filters static commands and page nodes by label/keywords; empty query shows default sections
- **Accessibility**: Full ARIA attributes, focus trap, scroll lock, keyboard navigation
- **Animations**: FramerMotion glassmorphism modal with backdrop blur

## Dependencies
- [[WikiStore]] — reads `graphData`, `recentPages`, `favorites`
- [[ReactRouter]] `useNavigate` — for page navigation
- [[FramerMotion]] + [[AnimatePresence]] — animations
- `useFocusTrap` — focus containment
- `useBodyScrollLock` — scroll prevention
- [[i18next]] — internationalization

## Related
- [[Header]] — also has a search popover with keyboard navigation
- [[RootLayout]] — integrates CommandPalette as a top-level modal