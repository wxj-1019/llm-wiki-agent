---
title: "RootLayout — Main Application Layout Component for LLM Wiki Viewer"
type: source
tags: [frontend, typescript, react, layout, routing]
date: 2026-05-14
source_file: RootLayout.tsx
---

## Summary
The `RootLayout` component is the main application shell for the [[LLMWikiViewer]] frontend. It orchestrates the top-level layout: `[[Header]]`, `[[Sidebar]]`, `[[CommandPalette]]`, `[[IngestProgress]]` bar, `[[AlertBanner]]`, reactive `[[ToastContainer]]`, `[[PageSkeleton]]` loading state, `[[ScrollToTop]]` button, animated page transitions via `[[FramerMotion]]`, and skip-to-content accessibility link. It integrates [[useNetworkStatus]], [[usePWAInstall]], [[useSWUpdate]], [[useKeyboardShortcuts]], [[useEventStream]], and the [[WikiStore]] Zustand store.

## Key Claims
- **Dynamic page transitions**: `PageTransition` component uses `getPageAnimation()` to select animation variants based on route path: graph/mindmap pages get `opacity + scale`, deeper pages (upload/chat/settings/status/mcp/skills/dashboard/crawler/timeline) get `opacity + x` slide, all others get `opacity + y` fade-up. Transitions use [[AnimatePresence]] `mode="wait"`.
- **Banner height measurement**: Uses `ResizeObserver` on `bannerRef` to dynamically measure `[[AlertBanner]]` height, setting `paddingTop` on the main content container. Re-measures when any of `[isOnline, updateAvailable, canInstall, apiConnected, alertCount]` changes. Dependency on `alertCount` is explicitly noted (B3: "subscribe to alert count for ResizeObserver dependency").
- **Backend connection monitoring**: Receives `connectionState` from [[useEventStream]] hook (P7 integration) and passes it to the [[Header]] component. [[useEventStream]] also receives `navigate` to enable navigation-driven stream reconnection (P5).
- **Error/loading/offline states**: Three rendering modes: (1) `loading` → `[[PageSkeleton]]` skeleton loader, (2) `error` → centered error panel with `[[AlertTriangle]]` icon, error message, and retry button calling `initialize()`, (3) normal → animated `[[AnimatePresence]]` outlet. `[[AlertBanner]]` handles offline backend detection and PWA update/install prompts.
- **PWA integration**: [[usePWAInstall]] provides `canInstall` and `install` callbacks, [[useSWUpdate]] provides `updateAvailable` and `applyUpdate`. Both feed into `[[AlertBanner]]` for user-facing prompts.
- **Smart scroll restoration**: `useEffect` scrolls to top on route change, but skips detail pages matching `/^\/(s|e|c|y)\//` (source/entity/concept/synthesis pages) — `[[PageDetailPage]]` handles scroll restoration for those.
- **Sidebar-responsive main area**: `main` element sets left margin based on `sidebarCollapsed`: `md:ml-60` (240px) when expanded, `md:ml-14` (56px) when collapsed, `transition-all duration-300` for smooth animation. Mobile uses no margin (sidebar is overlay). Non-graph pages get `max-w-5xl` content width constraint.
- **Keyboard shortcuts**: [[useKeyboardShortcuts]] hook is invoked at root level (called twice in the code, both `useKeyboardShortcuts()` calls).
- **Accessibility**: Skip-to-content anchor (`#main-content`) with `sr-only focus:not-sr-only` styling, `aria-*` attributes, proper `id` on main element.
- **Initialize on mount**: `initialize` from [[WikiStore]] is called in a `useEffect` on mount.

## Key Quotes
> (No notable quotes — code-only source)

## Connections
- [[Header]] — receives connectionState from useEventStream
- [[Sidebar]] — toggled via sidebarCollapsed state
- [[CommandPalette]] — rendered at root level
- [[IngestProgress]] — rendered at root level
- [[AlertBanner]] — dynamically measured height via ResizeObserver
- [[ToastContainer]] — rendered at root level
- [[PageSkeleton]] — shown during loading state
- [[ScrollToTop]] — rendered at root level
- [[useNetworkStatus]] — provides isOnline state
- [[usePWAInstall]] — provides PWA install capability
- [[useSWUpdate]] — provides service worker update detection
- [[useKeyboardShortcuts]] — global keyboard shortcut handling
- [[useEventStream]] — backend SSE connection state
- [[WikiStore]] — Zustand store for sidebar, loading, error, apiConnected
- [[useNotificationStore]] — provides alertCount for ResizeObserver dependency
- [[PageDetailPage]] — receives scroll restoration exemption
- [[Router]] — provides out-of-the-box outlet routing
- [[FramerMotion]] — animation library for page transitions
- [[Lucide]] — icon library for error state

## Contradictions
- None.