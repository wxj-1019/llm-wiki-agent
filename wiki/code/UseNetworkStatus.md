---
title: "useNetworkStatus"
type: code_func
tags: [frontend, typescript, react, hook, network]
sources: [usenetworkstatus-network-connectivity-hook]
---

## `useNetworkStatus()`

React hook that tracks browser online/offline status.

### Signature
```typescript
function useNetworkStatus(): boolean
```

### Returns
- `boolean` — `true` when the browser is online, `false` when offline

### Implementation
```typescript
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
```

### Dependencies
- [[useState]] — React state hook
- [[useEffect]] — React side effect hook
- `navigator.onLine` — browser API for initial connectivity check
- `window` `'online'`/`'offline'` events

### Related Components
- [[RootLayout]] — consumes `isOnline` for offline banner
- [[Header]] — displays network status indicator
- [[usePWAInstall]] — PWA installation hook
- [[useSWUpdate]] — service worker update hook