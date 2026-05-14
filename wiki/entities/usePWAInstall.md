---
title: "usePWAInstall"
type: entity
tags: [frontend, react, hook, pwa]
sources: [usepwainstall-pwa-install-hook]
last_updated: 2026-05-14
---

# usePWAInstall

`usePWAInstall` is a [[React]] hook that manages the [[PWA]] installation lifecycle. It listens for the browser's `beforeinstallprompt` event, checks `display-mode: standalone` for already-installed state, and provides a `canInstall` boolean and `install()` function to trigger the native install UI.

### Interface

```typescript
function usePWAInstall(): {
  canInstall: boolean; // true if prompt is available and app not yet installed
  install: () => Promise<void>; // trigger the install prompt
  isInstalled: boolean; // true if app is in standalone display mode
}
```

### Key Behavior
- Uses `window.matchMedia('(display-mode: standalone)')` to detect installed state (works across browsers)
- Stores the `beforeinstallprompt` event for later `install()` call
- Once user accepts or dismisses, `canInstall` becomes false until next page load
- All event listeners cleaned up on unmount

### Related
- [[useNetworkStatus]] — complements PWA offline detection
- [[RootLayout]] — host component for install banner
- [[BeforeInstallPromptEvent]] — the underlying browser event interface
- [[PWA]] — progressive web app standard