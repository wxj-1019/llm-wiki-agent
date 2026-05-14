---
title: "useSWUpdate"
type: code_module
tags: [frontend, hook, pwa, service-worker]
---

# `useSWUpdate` — Service Worker Update Hook

**File:** `useSWUpdate.ts`

## Signature
```typescript
export function useSWUpdate(): {
  updateAvailable: boolean;
  applyUpdate: () => void;
}
```

## Purpose
Detect when a new [[PWA]] service worker is available and provide a mechanism to activate it. Enables the "Update Available" UX pattern for the [[LLMWikiViewer]].

## Implementation Details
- **Update detection on mount**: Checks for `reg.waiting` immediately.
- **Installing worker listener**: Listens for `updatefound` → `statechange` to detect newly installed workers.
- **30-minute polling**: `setInterval` calls `reg.update()` every 30 minutes.
- **Apply update**: Posts `{ type: 'SKIP_WAITING' }` to the waiting worker.
- **Auto-reload on controller change**: Listens for `controllerchange`, triggers `window.location.reload()` (guarded against double-reload).
- **Cleanup**: Removes listeners and clears interval on unmount.
- **Graceful degradation**: Returns defaults if `navigator.serviceWorker` is unavailable.

## Dependencies
- React `useState`, `useEffect`, `useCallback`

## Related
- [[usePWAInstall]] — complementary PWA install hook
- [[RootLayout]] — consumer that likely integrates this hook
- [[ServiceWorker]] — browser API