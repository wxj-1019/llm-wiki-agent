---
title: "ChatSearchPanel — Search Panel Component"
type: code_module
tags: [typescript, react, component, search]
sources: [chatsearchpanel-search-panel-component]
last_updated: 2026-05-14
---

## ChatSearchPanel

Source: `ChatSearchPanel.tsx`

### Purpose
A React component providing dual-mode (wiki/web) search with debounced input, history, and quote-to-chat functionality for the [[ChatPage]] sidebar.

### Props
| Prop | Type | Description |
|---|---|---|
| `onQuote` | `(text: string) => void` | Callback invoked when user clicks "Quote" on a result |

### Internal State
| State | Type | Description |
|---|---|---|
| `mode` | `'wiki' \| 'web'` | Active search mode |
| `query` | `string` | Current search query |
| `results` | `Array<WikiSearchResult \| WebSearchResult>` | Search results |
| `loading` | `boolean` | Search loading indicator |
| `history` | `SearchHistory` | Per-mode search history |

### Key Functions
- **`loadSearchHistory()`** — loads search history from [[LocalStorage]]
- **`saveSearchHistory()`** — persists search history to [[LocalStorage]]

### Dependencies
- [[i18next]] — i18n via `useTranslation()`
- [[Lucide|Lucide React]] — icons: `Search`, `Globe`, `BookOpen`, `Loader2`, `ArrowRight`
- `@/services/chatService` — `searchWeb()`, `searchWiki()`, `WikiSearchResult`, `WebSearchResult`

### Behavior
- Debounced search with 400ms delay
- AbortController for request cancellation
- Per-mode history capped at 10 entries
- Quote button on hover per result