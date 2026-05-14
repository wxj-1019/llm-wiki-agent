---
title: "usePWAInstall Hook"
type: code_func
tags: [frontend, react, hook, pwa]
sources: [usepwainstall-pwa-install-hook]
last_updated: 2026-05-14
---

# `usePWAInstall()`

Source: `usePWAInstall.ts`

### Signature
```typescript
function usePWAInstall(): {
  canInstall: boolean;
  install: () => Promise<void>;
  isInstalled: boolean;
}
```

### Purpose
Manages the [[PWA]] installation lifecycle in React. Listens for `beforeinstallprompt`, detects installed state via `display-mode: standalone`, and exposes an imperative `install()` method.

### Parameters
None.

### Returns
| Property | Type | Description |
|---|---|---|
| `canInstall` | `boolean` | True when prompt event is available and app not yet installed |
| `install` | `() => Promise<void>` | Triggers the native install prompt |
| `isInstalled` | `boolean` | True when app runs in standalone display mode |

### Implementation Notes
- Uses lazy initializer pattern for state (`useState`)
- Callback-wrapped `install` with `useCallback` to avoid unnecessary re-renders
- The `beforeinstallprompt` event object is stored in state (it can only be used once)
- `display-mode: standalone` CSS media query is the canonical way to detect installed PWA (cross-browser)

### Related
- [[BeforeInstallPromptEvent]] — TypeScript interface for the stored event
- [[PWA]] — progressive web app standard
- [[usePWAInstall]] — entity page

### Usage Example
```tsx
const { canInstall, install } = usePWAInstall();
return canInstall ? <button onClick={install}>Install App</button> : null;
```