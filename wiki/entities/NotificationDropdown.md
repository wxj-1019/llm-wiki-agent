---
title: "NotificationDropdown"
type: entity
tags: [frontend, typescript, react, component]
sources: [notification-dropdown-component]
last_updated: 2026-05-14
---

# NotificationDropdown

`NotificationDropdown` is a React component in the [[LLMWikiViewer]] frontend. It renders a bell icon button that toggles a dropdown panel showing real-time notifications from the [[useNotificationStore]] Zustand store.

## Features
- Three notification types: success ([[CheckCircle]]), error ([[XCircle]]), info ([[Info]]), progress ([[Loader2]])
- Alert severity override: critical/warning with left border, success/info
- Unread count badge with spring animation (max `9+`)
- Auto mark-read on hover/focus via pointer detection
- Keyboard accessibility: focus trapping via [[useFocusTrap]], `aria-expanded`, `aria-haspopup`
- Internationalization via [[i18next]] with key prefix `notifications.*`
- Footer link to `/log` operation log page