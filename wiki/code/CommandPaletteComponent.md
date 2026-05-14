---
title: "CommandPalette — Command Palette Component"
type: code_module
tags: [frontend, typescript, react, command-palette]
sources: [command-palette-component]
last_updated: 2026-05-14
---

# CommandPalette

`CommandPalette.tsx` — a React function component that renders a modal command palette for the [[LLMWikiViewer]] frontend.

## Imports
- `react` (useState, useEffect, useRef, useCallback, useMemo)
- `react-router-dom` (useNavigate)
- `lucide-react` (Search, FileText, Users, Lightbulb, Layers, Settings, Network, Upload, BookOpen, Home, Clock, Heart, Command, MessageCircle)
- `@/stores/wikiStore` ([[WikiStore]] Zustand store)
- `@/lib/wikilink` (getPagePath)
- `framer-motion` (motion, AnimatePresence)
- `react-i18next` (useTranslation, [[i18next]])
- `@/hooks/useFocusTrap` ([[useFocusTrap]])
- `@/hooks/useBodyScrollLock` ([[useBodyScrollLock]])

## State
- `open: boolean` — palette visibility
- `query: string` — search input value
- `selectedIndex: number` — currently highlighted result index

## Memoized Data
- `nodes` — from graphData (Zustand)
- `staticCommands` — navigation commands (Home, Browse, Search, Graph, Upload, Chat, Settings)
- `recentCommands` — top 5 recent pages from `recentPages` store
- `favCommands` — top 5 favorites from `favorites` store
- `pageCommands` — all graph nodes mapped to command items with type-specific icons
- `allCommands` — filtered/ordered commands based on query: empty → static + recent + fav separators; non-empty → merged static + page matches

## Key Functions
- `handleKeyDown` — handles ArrowUp/Down/Enter, skipping separators
- `getPagePath` (from wikilink lib) — generates route path for a given node

## Side Effects
- Keyboard shortcut `Cmd/Ctrl+K` toggle + `Escape` close (useEffect with window event listener)
- Auto-focus input when palette opens (useEffect with requestAnimationFrame)
- Reset selectedIndex when `allCommands` changes (useEffect)
- Scroll active item into view (useEffect with scrollIntoView)

## Related Code
- [[Header]] — alternative search entry point
- [[WikiStore]] — state provider for graphData, recentPages, favorites