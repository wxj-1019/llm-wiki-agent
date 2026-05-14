---
title: "CommandPalette — Keyboard-Accessible Command Palette Component for LLM Wiki Viewer"
type: source
tags: [frontend, typescript, react, command-palette, keyboard-navigation, accessibility]
date: 2026-05-14
source_file: CommandPalette.tsx
---

## Summary
The `CommandPalette` component (`CommandPalette.tsx`) provides a modal quick-action interface triggered by `Cmd/Ctrl+K`. It integrates with the [[WikiStore]] Zustand store to display navigation commands, recent pages (from `recentPages`), favorited pages (from `favorites`), and all wiki graph nodes as searchable results. Features fuzzy-like keyword matching, keyboard navigation with arrow keys, focus trapping, body scroll locking, i18n support, and an animated glassmorphism overlay built with [[FramerMotion]] and [[AnimatePresence]].

## Key Claims
- **Keyboard shortcut toggle**: `Cmd/Ctrl+K` opens/closes the palette; `Escape` closes it. Event listener is added/removed via useEffect.
- **Four command sections**: Static navigation commands (Home, Browse, Search, Graph, Upload, Chat, Settings), recent pages (max 5, from `recentPages` store), favorite pages (max 5, from `favorites` store), and all graph nodes (searchable by title/type). Each section has a separator label when visible (localized via i18n).
- **Dual-mode search**: When query is empty, shows static commands + recent section (if any) + favorites section (if any). When query is non-empty, searches both static commands (by label/subtitle) and all page commands (by label/keywords). Empty results show "No results" message.
- **Keyboard navigation**: ArrowDown/ArrowUp cycle through results, skipping separator items. Enter selects the highlighted item and closes the palette. Selected index resets when results change.
- **Accessibility**: Uses `role="dialog"`, `aria-modal="true"`, `role="listbox"`, `role="option"`, `aria-selected`, `aria-autocomplete="list"`, `aria-activedescendant`, and `aria-label` on dialog. Focus is trapped via `useFocusTrap` hook. Body scroll is locked via `useBodyScrollLock` hook.
- **Visual design**: Glassmorphism modal (`glass rounded-2xl shadow-2xl`) with backdrop blur, search input with magnifying glass icon and keyboard shortcut badge, result items with icon containers (colored by page type or command category), selected state highlight, and footer showing keyboard shortcuts for navigation/select/close.
- **Page type icons**: Uses `typeIcons` mapping: `source` → [[FileText]], `entity` → [[Users]], `concept` → [[Lightbulb]], `synthesis` → [[Layers]]. Fallback to source icon for unknown types.
- **Dependencies**: [[ReactRouter]] `useNavigate` for navigation, `getPagePath()` from `@/lib/wikilink` for page path resolution, [[FramerMotion]] for animations, [[i18next]] for localization.

## Key Quotes
> "Keyboard shortcut: Cmd/Ctrl+K toggles open/close" — accessibility-focused UX
> "Focus is trapped via useFocusTrap hook" — modal accessibility best practice

## Connections
- [[RootLayout]] — likely integrates CommandPalette as a top-level modal alongside Header/Sidebar
- [[WikiStore]] — provides graphData, recentPages, favorites for dynamic command generation
- [[FramerMotion]] — powers all animations (backdrop fade, modal slide/scale, list enter/exit)
- [[AnimatePresence]] — manages mount/unmount transitions for the entire palette
- [[useFocusTrap]] — ensures keyboard focus stays within the modal when open
- [[useBodyScrollLock]] — prevents background scroll while palette is open
- [[Header]] — also uses search popover with keyboard navigation; CommandPalette is a more comprehensive alternative
- [[KeyboardShortcuts]] — consistent with the wiki viewer's keyboard-driven UX pattern
- [[i18next]] — internationalization for all UI strings (command labels, section headers, footer hints)
- [[DebouncedSearch]] — related search UX pattern, though CommandPalette does not debounce (instant on type)

## Contradictions
- No contradictions with existing wiki content.