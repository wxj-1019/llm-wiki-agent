---
title: "PWAInstallFlow"
type: concept
tags: [pwa, install, frontend]
sources: [usepwainstall-pwa-install-hook]
last_updated: 2026-05-14
---

# PWA Install Flow

The PWA installation flow involves capturing the browser's `beforeinstallprompt` event, storing it, and later triggering the native install prompt on user action. The `usePWAInstall` hook implements this pattern for React.

### Stages
1. **Event capture**: On page load, listen for `beforeinstallprompt`. Prevent default to suppress the browser's banner.
2. **State evaluation**: Check `display-mode: standalone` to determine if the app is already installed.
3. **User trigger**: On demand, call `prompt()` on the stored event to show the browser's install dialog.
4. **Outcome handling**: React to `userChoice` (accepted/dismissed), update installed state.
5. **Teardown**: Remove event listener on unmount.

### Related Patterns
- [[OfflineSupport]] — PWA's service worker + cache strategy
- [[AppShellArchitecture]] — typical PWA frontend pattern
- [[beforeinstallprompt]] — browser API event