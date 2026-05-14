---
title: "usePWAInstall — PWA Install Hook"
type: source
tags: [frontend, typescript, react, hook, pwa, install]
date: 2026-05-14
source_file: usePWAInstall.ts
---

## Summary
The `usePWAInstall` hook (`usePWAInstall.ts`) provides a React hook for managing Progressive Web App installation flow. It captures the `beforeinstallprompt` event, determines if the app is already installed via `display-mode: standalone`, and exposes a `canInstall` boolean and `install` function for triggering the browser's native install prompt.

## Key Claims
- **Capture install prompt**: Listens for the `beforeinstallprompt` event and prevents its default browser UI to allow custom install UX.
- **Detect installed state**: Uses `window.matchMedia('(display-mode: standalone)')` to detect whether the app is already installed, regardless of browser prompt history.
- **Trigger install**: The `install` callback shows the stored prompt and updates `isInstalled` based on user choice.
- **Clean teardown**: The `useEffect` removes the event listener on unmount.
- **Idempotent safe**: Once installed or prompt dismissed, `canInstall` returns `false`.
- **Zero dependencies beyond React**: Only imports `useState`, `useEffect`, and `useCallback`.

## Key Quotes
> "`window.matchMedia('(display-mode: standalone)').matches`" — detection of installed PWA via CSS media query
> "`const { outcome } = await promptEvent.userChoice; if (outcome === 'accepted') { setIsInstalled(true); }`" — user decision handling

## Connections
- [[PWA]] — core web standard this hook implements
- [[RootLayout]] — likely consumer for installation banner/prompt
- [[Header]] — potential location for install button UI
- [[useNetworkStatus]] — complementary hook for PWA offline features
- [[ThemeSwitch]] — PWA-friendly UI components

## Contradictions
- None identified.