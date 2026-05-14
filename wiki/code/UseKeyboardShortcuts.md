---
title: "useKeyboardShortcuts"
type: code_func
tags: [frontend, typescript, react, hook, keyboard]
sources: [usekeyboardshortcuts-global-keyboard-shortcuts-hook]
last_updated: 2026-05-14
---

# `useKeyboardShortcuts()`

Global keyboard shortcut hook for the [[LLMWikiViewer]] frontend.

## Signature
```typescript
export function useKeyboardShortcuts(): void
```

## Purpose
Registers a global `keydown` listener on `window` that maps keyboard shortcuts to navigation actions via [[ReactRouter]]'s `useNavigate`:

| Shortcut | Action |
|---|---|
| `/` | Focus search input (`[data-search-input]`) |
| `Ctrl/Cmd+G` | Navigate to `/graph` ([[GraphPage]]) |
| `Ctrl/Cmd+C` | Navigate to `/chat` ([[ChatPage]]) |
| `Ctrl/Cmd+H` | Navigate to `/` ([[HomePage]]) |

## Implementation Details
- Uses [[useEffect]] to register/unregister the `keydown` listener on mount/unmount.
- Input-guard: skips processing if `e.target` is `HTMLInputElement` or `HTMLTextAreaElement`.
- Cross-platform modifier: checks `e.ctrlKey || e.metaKey` for Ctrl (Windows) / Cmd (Mac) compatibility.

## Dependencies
- [[React]] (`useEffect`)
- `react-router-dom` (`useNavigate`)

## Related Code
- [[Header]] — defines `[data-search-input]` target
- [[RouterDefinition]] — route mappings
- [[CommandPalette]] — alternative keyboard-triggered navigation (Cmd+K)