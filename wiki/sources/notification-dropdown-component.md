---
title: "NotificationDropdown — Notification Bell Dropdown Component for LLM Wiki Viewer"
type: source
tags: [frontend, typescript, react, notifications, dropdown, accessibility]
date: 2026-05-14
source_file: NotificationDropdown.tsx
---

## Summary
The `NotificationDropdown` component (`NotificationDropdown.tsx`) is a bell icon-triggered dropdown that displays real-time notifications in the [[LLMWikiViewer]] frontend. It integrates with the [[useNotificationStore]] Zustand store, supports unread counts with spring animation, three notification types (success/error/info/progress) with severity-based styling for alerts, full keyboard accessibility (focus trapping via [[useFocusTrap]], pointer-interaction-based mark-read, and dismiss/clear-all actions), and a footer link to the operation log page.

## Key Claims
- **Icon-based notification types**: Uses `iconMap` to map `success` → [[CheckCircle]], `error` → [[XCircle]], `info` → [[Info]], `progress` → [[Loader2]]. Each type has a distinct color (emerald, red, apple-blue, apple-purple). Notifications with `isAlert` flag and `severity` field (critical/warning/success/info) override icon color and add left border via `severityColorMap` and `severityBorderMap`.
- **Unread badge**: Bell button shows a spring-animated red badge with exact count (max `9+`). Uses [[FramerMotion]] `motion.span` with `initial={{ scale: 0 }}` → `animate={{ scale: 1 }}`.
- **Notification list**: Renders in `max-h-80 overflow-y-auto` container. Each item shows: type icon, message text, relative timestamp (via [[formatDistanceToNow]] from `dateUtils`), and a dismiss button (`[[Trash2]]` icon). Unread items get a semi-transparent background (`bg-[var(--bg-secondary)]/40`). Hover/focus triggers `markRead(n.id)` to auto-mark as read.
- **Empty/gesture states**: When no notifications, shows centered "暂无通知" text. Three action buttons in header: `markAllRead` ([[CheckCheck]] icon), `clearNotifications` ([[Trash2]] icon), and footer link to `/log` page ([[ScrollText]] icon). All buttons have hover transitions and accessible labels.
- **Accessibility**: Button uses `aria-expanded` and `aria-haspopup`. Dropdown uses `motion.div` with focus trap via [[useFocusTrap]]. Backdrop click (`fixed inset-0 z-40`) closes dropdown. Outside click detection via `useEffect` + `mousedown` listener.
- **Internationalization**: All strings use `useTranslation()` with keys: `notifications.title`, `notifications.markAllRead`, `notifications.clearAll`, `notifications.empty`, `notifications.dismiss`, `notifications.viewLog`. Consistent with [[Header]] and [[ChatSearchPanel]] i18n patterns.

## Key Quotes
> "Icon map: success → CheckCircle, error → XCircle, info → Info, progress → Loader2" — type-to-icon mapping
> "Severity override: critical/warning/success/info with left border for critical/warning" — alert severity styling
> "Unread badge spring animation: scale 0→1, max 9+" — badge behavior

## Connections
- [[useNotificationStore]] — Zustand store that provides notifications, unreadCount, markRead, markAllRead, clearNotifications, removeNotification
- [[useFocusTrap]] — hook for focus trapping within the dropdown when open
- [[Header]] — component that likely renders the `NotificationDropdown` bell button
- [[formatDistanceToNow]] — date utility for relative timestamps
- [[FramerMotion]] — used for badge spring animation and dropdown enter/exit transitions
- [[ChatSearchPanel]] — shares similar i18n pattern and dropdown architecture
- [[NotificationService]] — backend entity that may produce notifications (A-share platform)

## Contradictions
- No contradictions with existing wiki content.