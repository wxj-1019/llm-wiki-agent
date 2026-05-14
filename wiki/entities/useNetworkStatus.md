---
title: "useNetworkStatus"
type: entity
tags: [frontend, hook, network, offline]
---

`useNetworkStatus` is a React custom hook defined in `useNetworkStatus.ts` that tracks the browser's connectivity state. It provides a single boolean return value (`isOnline`) that reflects `navigator.onLine`, updated reactively via `'online'`/`'offline'` window events.

## API
```typescript
function useNetworkStatus(): boolean
```

Returns `true` when online, `false` when offline.

## Usage Context
- [[RootLayout]] — displays offline indicator banner
- [[Header]] — renders network status icon
- Complements [[usePWAInstall]] and [[useSWUpdate]] for comprehensive PWA support

## Implementation Details
- Lazy initializer `useState(() => navigator.onLine)` ensures correct startup value
- Event listeners registered once via `useEffect` with empty dependency array
- Cleanup removes both `online` and `offline` listeners on unmount

See [[usenetworkstatus-network-connectivity-hook|useNetworkStatus — Network Connectivity Hook]] for full source documentation.