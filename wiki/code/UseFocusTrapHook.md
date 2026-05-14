---
title: "useFocusTrap — Focus Trap Hook"
type: code_func
source_file: useFocusTrap.ts
tags: [hook, accessibility, keyboard]
---

# useFocusTrap

## Signature
```typescript
function useFocusTrap<T extends HTMLElement>(active: boolean): React.RefObject<T>
```

## Purpose
Traps [[Tab]] key focus inside a container element while the `active` flag is `true`. Restores focus to the previously focused element upon deactivation. Used by [[CommandPalette]], [[ChatSearchPanel]], [[NotificationDropdown]] for keyboard accessibility.

## Parameters
- `active: boolean` — when `true`, focus trapping is enabled; when `false`, the effect is skipped and focus is not restored

## Returns
- `React.RefObject<T>` — a ref object to be attached to the container element (`<div ref={containerRef}>`)

## Internals

The hook uses `document.activeElement` to capture the previously focused element before activation. On mount (when `active` becomes `true`), it immediately focuses the first focusable element inside the container using `container.querySelectorAll(FOCUSABLE_SELECTOR)`. The `keydown` event listener intercepts [[Tab]] key presses:

- **Tab (no Shift)**: If `document.activeElement` is the last focusable element (or outside the container), focus wraps to the first element.
- **Shift+Tab**: If `document.activeElement` is the first focusable element (or outside the container), focus wraps to the last element.

On cleanup (deactivation or unmount), the handler is removed and focus is restored to `previousFocusRef.current` if it's a valid `HTMLElement`.

### Focusable Selector
```typescript
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]',
].join(', ');
```

## Usage
```typescript
function MyModal({ open }: { open: boolean }) {
  const containerRef = useFocusTrap<HTMLDivElement>(open);

  return (
    <div ref={containerRef} role="dialog" aria-modal="true">
      <button>Confirm</button>
      <button>Cancel</button>
    </div>
  );
}
```

## Related
- [[useBodyScrollLock]] — companion hook for modal body scroll prevention
- [[CommandPaletteUX]] — conceptual pattern using focus trapping
- [[WCAG]] — accessibility standard requiring focus management for modals
- [[Header]] — uses [[CommandPalette]] which depends on this hook