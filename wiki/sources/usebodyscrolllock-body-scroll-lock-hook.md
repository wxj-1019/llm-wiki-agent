---
title: "useBodyScrollLock — Body Scroll Lock Hook"
type: source
tags: [frontend, typescript, react, hook, scroll, accessibility]
date: 2026-05-14
source_file: useBodyScrollLock.ts
---

## Summary
The `useBodyScrollLock` hook (`useBodyScrollLock.ts`) provides a lightweight utility for locking body scroll when `locked` is true. It saves the original `document.body.style.overflow` value before setting it to `'hidden'`, and restores it on unlock or component unmount. This is essential for preventing background scrolling behind modals, popovers, and sidebars in the [[LLMWikiViewer]] frontend.

## Key Claims
- **Scroll locking when active**: When `locked` is `true`, the hook saves the current `document.body.style.overflow` then sets it to `'hidden'`, preventing background scrolling.
- **Restoration on unlock/unmount**: The cleanup function restores the original overflow value, ensuring no leakage of scroll state.
- **Zero dependencies beyond React**: Only imports `useEffect`.
- **Minimal API**: Accepts a single boolean parameter `locked`. No refs or DOM queries needed.

## Key Quotes
> "`const original = document.body.style.overflow; document.body.style.overflow = 'hidden';`" — save-then-lock pattern
> "`return () => { document.body.style.overflow = original; };`" — cleanup restoration

## Connections
- [[Header]] — used in mobile/overlay sidebar scenarios where body scroll must be prevented
- [[Sidebar]] — likely consumer when the sidebar is shown as a mobile overlay
- [[CommandPalette]] — would benefit from scroll lock to prevent background scroll
- [[Modal]] — general pattern for any overlay/modal component
- [[useEffect]] — React hook for side effect registration

## Contradictions
- None identified.
