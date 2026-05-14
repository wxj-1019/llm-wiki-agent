---
title: "RootLayout"
type: code_module
tags: [frontend, react, layout, component]
sources: [root-layout-main-application-layout-component]
last_updated: 2026-05-14
---

# `RootLayout`

**File:** `wiki-viewer/src/components/layout/RootLayout.tsx`

Main application layout component exported as a named export. Serves as the top-level shell for the [[LLMWikiViewer]] frontend.

## Purpose
Orchestrates the top-level layout: fixed [[Header]], collapsible [[Sidebar]], [[CommandPalette]], animated page transitions, [[IngestProgress]] bar, [[AlertBanner]] with dynamic height measurement, [[ToastContainer]], loading/error/offline states, skip-to-content link, and [[ScrollToTop]] button.

## Imports
- `react-router-dom` — `useOutlet`, `useLocation`, `useNavigate`
- `react` — `useEffect`, `useRef`, `useState`, `useCallback`
- `framer-motion` — `AnimatePresence`, `motion`
- `react-i18next` — `useTranslation`
- `@/stores/wikiStore` — `useWikiStore`
- `@/stores/notificationStore` — `useNotificationStore`
- `./Header` — `Header`
- `./Sidebar` — `Sidebar`
- `./CommandPalette` — `CommandPalette`
- `@/components/ui/ToastContainer` — `ToastContainer`
- `@/components/ui/AlertBanner` — `AlertBanner`
- `@/components/upload/IngestProgress` — `IngestProgress`
- `@/components/ui/Skeleton` — `PageSkeleton`
- `@/components/ui/ScrollToTop` — `ScrollToTop`
- `lucide-react` — `AlertTriangle`, `RefreshCw`
- `@/hooks/useNetworkStatus` — `useNetworkStatus`
- `@/hooks/usePWAInstall` — `usePWAInstall`
- `@/hooks/useSWUpdate` — `useSWUpdate`
- `@/hooks/useKeyboardShortcuts` — `useKeyboardShortcuts`
- `@/hooks/useEventStream` — `useEventStream`

## State & Props
| Name | Source | Type | Description |
|------|--------|------|-------------|
| `sidebarCollapsed` | [[WikiStore]] | `boolean` | Controls sidebar width |
| `loading` | [[WikiStore]] | `boolean` | Shows skeleton on mount |
| `error` | [[WikiStore]] | `string \| null` | Error message for retry view |
| `apiConnected` | [[WikiStore]] | `boolean` | Backend connectivity flag |
| `isOnline` | [[useNetworkStatus]] | `boolean` | Browser online status |
| `canInstall` | [[usePWAInstall]] | `boolean` | PWA installable flag |
| `install` | [[usePWAInstall]] | `() => void` | PWA install trigger |
| `updateAvailable` | [[useSWUpdate]] | `boolean` | Service worker update flag |
| `applyUpdate` | [[useSWUpdate]] | `() => void` | SW update apply trigger |
| `connectionState` | [[useEventStream]] | `string` | SSE connection status |
| `alertCount` | [[useNotificationStore]] | `number` | Count of alert notifications |
| `bannerHeight` | local | `number` | Measured banner height |

## Key Behavior
1. Calls `initialize()` from [[WikiStore]] on mount
2. Measures [[AlertBanner]] height via [[ResizeObserver]] with dynamic dependencies
3. Scrolls to top on route change (exempting detail pages)
4. Renders three states: loading ([[PageSkeleton]]), error ([[AlertTriangle]] + retry), or normal ([[AnimatePresence]])
5. Passes `connectionState` to [[Header]], `navigate` to [[useEventStream]]

## Related
- [[RootLayout]] (entity)
- [[AdaptivePageTransitions]]
- [[DynamicBannerHeightMeasurement]]
- [[SmartScrollRestoration]]