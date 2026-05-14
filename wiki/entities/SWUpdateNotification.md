---
title: "SWUpdateNotification"
type: entity
tags: [frontend, pwa, ui]
---

SWUpdateNotification represents the UI pattern for prompting users when a new version of the [[PWA]] is available. In the [[LLMWikiViewer]], this pattern is driven by the [[useSWUpdate]] hook, which detects waiting service workers. The typical UX is a banner or toast (via [[useToast]]) allowing the user to "Refresh to update" or auto-applying the update gracefully.

**Source:** [[useSWUpdate — Service Worker Update Hook]]