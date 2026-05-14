---
title: "useSWUpdate"
type: entity
tags: [frontend, hook, pwa]
---

[[useSWUpdate]] is a React hook in the [[LLMWikiViewer]] frontend that manages [[PWA]] service worker update detection and application. It provides:
- `updateAvailable`: boolean indicating if a new service worker is waiting
- `applyUpdate`: callback to activate the new worker and trigger a page reload

The hook polls for updates every 30 minutes, detects waiting/installing workers, and handles automatic reload via `controllerchange` event. It complements [[usePWAInstall]] for the full PWA lifecycle.

**Source:** [[UseSWUpdateHook]]