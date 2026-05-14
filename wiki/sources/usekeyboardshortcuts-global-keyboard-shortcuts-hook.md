---
title: "useKeyboardShortcuts — Global Keyboard Shortcuts Hook"
type: source
tags: [frontend, typescript, react, hook, keyboard, navigation]
date: 2026-05-14
source_file: useKeyboardShortcuts.ts
---

## Summary
The `useKeyboardShortcuts` hook (`useKeyboardShortcuts.ts`) provides global keyboard shortcut bindings for the [[LLMWikiViewer]] frontend using [[ReactRouter]]'s `useNavigate`. It captures `Ctrl/Cmd+G` → graph page, `Ctrl/Cmd+C` → chat page, `Ctrl/Cmd+H` → home page, and `/` → search input focus. It auto-excludes input/textarea targets to avoid interference with text entry.

## Key Claims
- **Input-aware filtering**: Ignores all keydown events when `e.target` is an `HTMLInputElement` or `HTMLTextAreaElement`, preventing shortcut hijacking during text entry.
- **Search focus on `/`**: Pressing `/` (outside an input) focuses the first element with `[data-search-input]` attribute via `document.querySelector`.
- **Ctrl/Cmd shortcuts**: Uses `e.ctrlKey || e.metaKey` to support both Windows (Ctrl) and Mac (Cmd): `Cmd+G` → `/graph`, `Cmd+C` → `/chat`, `Cmd+H` → `/`.
- **Clean teardown**: The `useEffect` returns a `removeEventListener` cleanup, preventing listener leaks on unmount.
- **Zero dependencies beyond React Router**: Only imports `useEffect` and `useNavigate`.

## Key Quotes
> "`if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) { return; }`" — input-aware guard clause
> "`const searchInput = document.querySelector('[data-search-input]') as HTMLElement; if (searchInput) searchInput.focus();`" — search focus on `/`

## Connections
- [[Header]] — defines target `[data-search-input]` that the `/` shortcut focuses
- [[RouterDefinition]] — routes `/graph`, `/chat`, and `/` correspond to GraphPage, ChatPage, HomePage
- [[GraphPage]] — Ctrl/Cmd+G navigates here
- [[ChatPage]] — Ctrl/Cmd+C navigates here
- [[HomePage]] — Ctrl/Cmd+H navigates here
- [[useEffect]] — React hook for side effect registration
- [[useNavigate]] — React Router hook for programmatic navigation

## Contradictions
- None identified.