---
title: "Header"
type: entity
tags: [frontend, component, react, typescript]
sources: [header-component-wiki-viewer-navigation-bar]
last_updated: 2026-05-14
---

The `Header` component is the main top navigation bar for the [[LLMWikiViewer]] frontend. Built with React and TypeScript (`Header.tsx`), it provides:

- **Search popover**: 150ms debounced `searchNodes()` with keyboard navigation, `Ctrl+K` shortcut
- **Theme switching**: light/system/dark via `useWikiStore.setTheme()`
- **Sidebar toggle**: collapse/expand sidebar via `useWikiStore.toggleSidebar()`
- **SSE status indicator**: green/amber/red dot for connection state
- **Language switcher**: `[[LanguageSwitcher]]` component using `[[AppleSelect]]` and `[[SUPPORTED_LANGUAGES]]`
- **Notification dropdown**: `[[NotificationDropdown]]` component
- **Graph link**: navigates to `[[GraphPage]]` via `/graph`

Uses `[[FramerMotion]]` animations, `[[useFocusTrap]]` for accessibility, and `[[i18next]]` for internationalization. Apple glassmorphism styling with `backdrop-blur-xl`.

See [[HeaderComponent—WikiViewerNavigationBar]] for full details.