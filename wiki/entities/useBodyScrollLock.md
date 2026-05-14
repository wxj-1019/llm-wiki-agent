---
title: "useBodyScrollLock"
type: entity
tags: [frontend, hook, accessibility, react]
sources: [command-palette-component]
last_updated: 2026-05-14
---

# useBodyScrollLock

`useBodyScrollLock` is a React hook that prevents background scrolling when a modal is open. It is used by the [[CommandPalette]] component.

## Usage
- Imported from `@/hooks/useBodyScrollLock`
- Accepts a boolean `active` flag; when true, locks body scroll
- Companion to [[useFocusTrap]] for full modal accessibility

## Related
- [[useFocusTrap]] — focus containment hook
- [[CommandPalette]] — primary consumer