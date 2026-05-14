---
title: "ChatConversation"
type: code_module
tags: [react, typescript, component, chat]
sources: [chatconversation-chat-message-list-component]
last_updated: 2026-05-14
---

# ChatConversation

The `ChatConversation` component (exported as a named function) renders a virtualized, scrollable list of chat messages with date dividers, scroll-to-bottom, and loading/empty states.

## Signature

```tsx
function ChatConversation({
  entries, loading, streaming, showScrollToBottom, copiedIndex,
  onCopy, onReply, onToggleBookmark, onContinue, onSourceClick,
  onDelete, onEdit, onRegenerate, onScrollToBottom, scrollRef,
  renderWindow, findQuery,
}: ChatConversationProps): JSX.Element
```

## Purpose

Provides the core conversation display for [[ChatPage]]. Uses virtual scrolling via `renderWindow` to keep DOM size bounded. Delegates per-message rendering to [[ChatMessage]].

## Props (ChatConversationProps)

| Prop | Type | Description |
|---|---|---|
| `entries` | `ChatEntry[]` | Ordered list of chat messages |
| `loading` | `boolean` | Whether initial/background loading is active |
| `streaming` | `boolean` | Whether a streaming response is in progress |
| `showScrollToBottom` | `boolean` | Whether to show the scroll-to-bottom FAB |
| `copiedIndex` | `number \| null` | Index of currently copied message |
| `onCopy` | `(content: string, index: number) => void` | Copy message content |
| `onReply` | `(index: number) => void` | Reply to a message |
| `onToggleBookmark` | `(index: number) => void` | Toggle bookmark |
| `onContinue` | `(index: number) => void` | Continue generating from a message |
| `onSourceClick` | `(path: string) => void` | Navigate to a wiki source |
| `onDelete` | `(index: number) => void` | Delete a message |
| `onEdit` | `(index: number, content: string) => void` | Edit a message |
| `onRegenerate` | `() => void` | Regenerate the last assistant response |
| `onScrollToBottom` | `() => void` | Scroll to the bottom of the list |
| `scrollRef` | `React.RefObject<HTMLDivElement>` | Ref to the scroll container |
| `renderWindow` | `number` | Number of entries to render (virtual scroll) |
| `findQuery` | `string` | Search query for in-conversation find |

## Helper Functions

### `formatTime(ts?: number): string`
Converts a UNIX timestamp to `HH:MM` locale time string.

### `formatDateDivider(ts?: number, t?: (key: string) => string): string`
Returns "Today", "Yesterday", or a locale-formatted date string based on the timestamp relative to the current date.

## Subcomponents
- [[ChatMessage]] — renders individual message entries

## Dependencies
- [[i18next]] via `useTranslation()` for date labels
- [[Lucide]] for ArrowDown icon

## Connections
- [[ChatPage]] — parent component that owns state and passes props
- [[VirtualScrolling]] — the technique used to limit DOM nodes
- [[DateDivider]] — the date separator pattern
- [[ScrollToBottom]] — the floating button pattern