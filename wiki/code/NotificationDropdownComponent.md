---
title: "NotificationDropdown — Notification Bell Dropdown Component"
type: code_module
tags: [frontend, typescript, react]
sources: [notification-dropdown-component]
last_updated: 2026-05-14
---

# NotificationDropdown (Component)

**File:** `wiki-viewer/src/components/ui/NotificationDropdown.tsx`

## Purpose
Renders a bell icon button that toggles a dropdown panel with real-time notifications.

## Interface
- **Props:** None (state from Zustand store [[useNotificationStore]])
- **Returns:** JSX.Element (button + AnimatePresence conditional dropdown)

## State Dependencies
| Hook/Store | Data |
|---|---|
| `useNotificationStore` | `notifications`, `unreadCount()`, `markRead`, `markAllRead`, `clearNotifications`, `removeNotification` |
| `useTranslation` | i18n strings (prefix `notifications.*`) |
| `useFocusTrap` | Focus trapping on dropdown ref (`trapRef`) |
| `useState` | `open` toggle |
| `useRef` | `dropdownRef` for outside click detection |
| `useEffect` | Outside click listener, cleanup |

## Sub-components
- `iconMap`: Maps `'success'|'error'|'info'|'progress'` to Lucide React icon components.
- `colorMap`: Maps notification type to Tailwind color class.
- `severityColorMap`: Maps `'critical'|'warning'|'success'|'info'` to tailwind color (for `isAlert` notifications).
- `severityBorderMap`: Maps `'critical'|'warning'` to `border-l-*` classes.

## Related
- [[Header]] — likely renders this component in the nav bar
- [[useNotificationStore]] — see entity/useNotificationStore.md
- [[formatDistanceToNow]] — see entity/formatDistanceToNow.md
- [[NotificationService]] — backend entity for server-sent notifications