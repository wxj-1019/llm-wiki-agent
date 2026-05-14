---
title: "useSWUpdate — Service Worker Update Hook"
type: source
tags: [frontend, typescript, react, hook, pwa, service-worker, update]
date: 2026-05-14
source_file: useSWUpdate.ts
---

## Summary
The `useSWUpdate` hook (`useSWUpdate.ts`) provides a React hook for detecting and applying [[PWA]] service worker updates. It checks for a waiting service worker on mount, polls for updates every 30 minutes, and exposes an `applyUpdate` function that posts a `SKIP_WAITING` message to activate the new worker. A `controllerchange` listener triggers a full page reload to load the updated app shell.

## Key Claims
- **Update detection on mount**: On mount, checks if `reg.waiting` exists (new worker already waiting for activation). If so, sets `updateAvailable = true` immediately.
- **Watch for new installs**: Listens for `updatefound` on the registration, then watches the installing worker's `statechange`. When state becomes `'installed'` AND there is an active controller (not first install), sets `updateAvailable = true`.
- **30-minute polling**: Uses `setInterval` to call `reg.update()` every 30 minutes, prompting the browser to check the server for a new service worker script.
- **Apply update**: `applyUpdate` callback posts `{ type: 'SKIP_WAITING' }` to the waiting worker, which typically triggers the `controllerchange` event.
- **Automatic reload**: A `controllerchange` listener calls `window.location.reload()` once, using a `refreshing` guard to prevent multiple reloads.
- **Cleanup**: Removes the `controllerchange` listener and clears the poll interval on unmount.
- **Graceful degradation**: Returns `updateAvailable = false` and no-op `applyUpdate` if service workers are not supported.
- **Zero dependencies beyond React**: Only imports `useState`, `useEffect`, and `useCallback`.

## Key Quotes
> "`const interval = setInterval(() => { navigator.serviceWorker.ready.then((reg) => { reg.update().catch(() => {}); }); }, 30 * 60 * 1000);`" — 30-minute polling for updates
> "`if (reg.waiting) { setUpdateAvailable(true); return; }`" — immediate detection of already-waiting worker
> "`if (newWorker.state === 'installed' && navigator.serviceWorker.controller) { setUpdateAvailable(true); }`" — detect newly installed worker that should prompt user
> "`reg.waiting.postMessage({ type: 'SKIP_WAITING' });`" — trigger for activating the new worker
> "`let refreshing = false; ... if (refreshing) return; refreshing = true; window.location.reload();`" — guard against multiple reloads

## Connections
- [[PWA]] — core PWA technology enabling service worker updates
- [[usePWAInstall]] — complementary hook for PWA install flow
- [[RootLayout]] — likely consumer for displaying update notification banners
- [[Header]] — potential location for update badge/button UI
- [[useNetworkStatus]] — complements PWA offline capabilities
- [[ServiceWorker]] — browser API this hook wraps
- [[SWUpdateNotification]] — UI pattern for "Update Available" prompts

## Contradictions
- None identified.