---
title: "useNetworkStatus — Network Connectivity Hook"
type: source
tags: [frontend, typescript, react, hook, network, offline, online]
date: 2026-05-14
source_file: useNetworkStatus.ts
---

## Summary
The `useNetworkStatus` hook (`useNetworkStatus.ts`) provides a lightweight React hook that tracks the browser's online/offline status. It initializes `isOnline` using `navigator.onLine`, then listens to the `'online'` and `'offline'` window events to reactively update state. The hook cleans up its event listeners on unmount, preventing memory leaks. This is essential for offline-aware components in the [[LLMWikiViewer]] frontend such as the [[RootLayout]] which needs to display an offline indicator.

## Key Claims
- **Initial state from `navigator.onLine`**: Uses `useState(() => navigator.onLine)` lazy initialization for accurate starting state.
- **Reactive to `online`/`offline` events**: Registers `window.addEventListener('online', ...)` and `window.addEventListener('offline', ...)` inside `useEffect`.
- **Simple API**: Returns a single boolean `isOnline` — `true` when the browser reports connectivity, `false` otherwise.
- **Clean teardown**: The `useEffect` cleanup removes both event listeners to prevent stale closures and memory leaks.
- **Zero dependencies beyond React**: Only imports `useState` and `useEffect`.

## Key Quotes
> "`const [isOnline, setIsOnline] = useState(() => navigator.onLine);`" — lazy initialization with browser API
> "`const handleOnline = () => setIsOnline(true); const handleOffline = () => setIsOnline(false);`" — event handlers for connectivity changes
> "`return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };`" — cleanup pattern

## Connections
- [[RootLayout]] — uses `useNetworkStatus` for offline state banner in the main application shell
- [[Header]] — network status indicator displayed in the navigation bar
- [[usePWAInstall]] — PWA-related hook, complements offline awareness
- [[useSWUpdate]] — service worker update management, related to online/offline lifecycle
- [[PWA]] — progressive web app offline capabilities
- [[useEffect]] — React hook for side effect registration
- [[useState]] — React hook for state management

## Contradictions
- None identified.
