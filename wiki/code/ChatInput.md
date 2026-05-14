---
title: "ChatInput — Chat Input Component"
type: code_module
tags: [frontend, typescript, react, component]
source: ChatInput.tsx
last_updated: 2026-05-14
---

# ChatInput

`ChatInput` is a React component (`ChatInput.tsx`) that provides the multi-function chat input area for the [[ChatPage]] in the [[LLMWikiViewer]] frontend.

## Signature

```tsx
export function ChatInput(props: ChatInputProps): JSX.Element
```

## Props (`ChatInputProps`)

| Prop | Type | Description |
|------|------|-------------|
| `value` | `string` | Current textarea value |
| `onChange` | `(value: string) => void` | Text input change handler |
| `onSend` | `() => void` | Send message callback |
| `onStop` | `() => void` | Stop streaming callback |
| `loading` | `boolean` | Loading state (disables send) |
| `streaming` | `boolean` | Whether SSE stream is active (shows stop button) |
| `online` | `boolean` | Offline state (disables all input) |
| `onSearchOpen` | `() => void` | Open search panel |
| `onSummarize` | `(style: string) => void` | Summarize with given style |
| `onGenerate` | `(target: 'skill' | 'mcp') => void` | Generate Skill or MCP |
| `onRefine` | `() => void` | Refine last response |
| `showSummarizeMenu` | `boolean` | Summarize menu visibility |
| `setShowSummarizeMenu` | `(v: boolean) => void` | Toggle summarize menu |
| `showMoreMenu` | `boolean` | More menu visibility |
| `setShowMoreMenu` | `(v: boolean) => void` | Toggle more menu |
| `textareaRef` | `React.RefObject<HTMLTextAreaElement>` | Ref for auto-resize |

## Internal Behavior

- **Auto-resize**: `useEffect` recalculates textarea height on `value` change, capped at 160px.
- **Click outside cleanup**: A `useEffect` attaches a `mousedown` listener to close both menus when clicking outside their refs.
- **Keyboard handler**: `handleKeyDown` dispatches `onSend` on Enter (no Shift) when not loading and value non-empty.

## Dependencies

- [[i18next]] — `useTranslation` for labels
- [[Lucide]] — icons (Square, ArrowUp, Search, FileText, Zap, Plug, ChevronDown, MoreHorizontal, Globe, BookOpen, Pencil, Wand2)
- React `useRef`, `useEffect`

## Related

- [[ChatPage]] — parent component
- [[ChatConversation]] — message list above the input