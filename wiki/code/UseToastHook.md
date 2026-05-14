---
title: "useToast — Toast Notification Hook"
type: code_func
tags: [frontend, typescript, react, hook, toast]
sources: [usetoast-toast-notification-hook]
last_updated: 2026-05-14
---

# `useToast` — Toast Notification Hook

**Signature:** `export function useToast(): { toasts: Toast[]; setToasts: React.Dispatch<React.SetStateAction<Toast[]>>; addToast: (message: string, type: 'success' | 'error') => void; removeToast: (id: string) => void }`

**Purpose:** Manages a list of ephemeral toast notifications with auto-dismiss, pause-on-hover, and manual removal.

**Internal state:**
- `toasts: Toast[]` — current array of visible toasts
- `toastTimers: React.MutableRefObject<Map<string, number>>` — persistent map of toast IDs to `setInterval` timer handles

**Returns:**
- `toasts` — current toast array for rendering
- `setToasts` — direct state setter (for bulk operations e.g., clearing all)
- `addToast(message, type)` — creates a new toast with a unique ID, starts a progress timer (30 ticks at 100ms = 3s), and removes it when progress reaches 0
- `removeToast(id)` — immediately removes the toast and clears its timer

**Toast interface:**
- `id` — unique string ID (`Math.random().toString(36).slice(2)`)
- `message` — display text
- `type` — `'success'` | `'error'` (styling variant)
- `paused` — boolean, when `true` the progress timer freezes
- `progress` — number 0–100, decremented every 100ms while not paused

**Connections:**
- [[Toast]] — toast data entity
- [[Header]] — potential UI consumer
