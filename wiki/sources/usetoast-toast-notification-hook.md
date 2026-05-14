---
title: "useToast — Toast Notification Hook"
type: source
tags: [frontend, typescript, react, hook, toast, notification, timer]
date: 2026-05-14
source_file: useToast.ts
---

## Summary
The `useToast` hook (`useToast.ts`) provides a lightweight toast notification system for the [[LLMWikiViewer]] frontend. It manages an array of toast objects with success/error types, auto-dismiss via a progress bar timer (30 ticks at 100ms each ≈ 3 seconds), pause-on-hover, and manual removal. The hook uses `useRef` to track timer IDs for cleanup.

## Key Claims
- **Auto-dismiss timer**: Each toast has a `progress` value (100 → 0) decremented every 100ms via `setInterval`, for a 3-second lifetime.
- **Pause on hover**: When `paused` is `true`, the progress counter stops decrementing, allowing the user to read the message without timeout.
- **Manual removal**: `removeToast` immediately filters out the toast and clears its associated timer via `toastTimers` ref.
- **Unique IDs**: Uses `Math.random().toString(36).slice(2)` to generate toast identifiers — no external ID library needed.
- **Timer lifecycle cleanup**: When a toast reaches zero progress or is removed, the associated `setInterval` timer is cleared via `window.clearInterval` and the ref entry is deleted.
- **Zero dependencies beyond React**: Only imports `useState`, `useCallback`, and `useRef`.

## Key Quotes
> "`const next = toast.progress - (100 / 30); if (next <= 0) { ... return prev.filter((t) => t.id !== id); }`" — progress decrement and auto-dismiss logic
> "`const toastTimers = useRef<Map<string, number>>(new Map());`" — persistent timer reference storage across renders
> "`if (toast.paused) return prev;`" — pause-on-hover guard, allowing progress to freeze

## Connections
- [[Header]] — likely consumer for displaying toast notifications from actions (e.g., "File uploaded", "Error fetching data")
- [[NotificationDropdown]] — complementary notification UI; toasts are ephemeral while dropdown stores persistent notifications
- [[useEventStream]] — toast can surface SSE connection status changes (reconnection, errors)
- [[ChatInput]] — could show toast on copy-to-clipboard or generation errors
- [[UploadPage]] — toast for upload success/failure feedback
- [[UseDebounce]] — could be combined for debounced toast removal

## Contradictions
- None identified.
