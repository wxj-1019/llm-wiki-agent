---
title: "DebouncedSearch"
type: concept
tags: [frontend, pattern, search]
sources: [chatsearchpanel-search-panel-component]
last_updated: 2026-05-14
---

**DebouncedSearch** is a search pattern that delays execution of a search query until user input pauses for a specified duration (400ms in [[ChatSearchPanel]]). This reduces API calls and network traffic while improving UX by avoiding flickering results on each keystroke. Implemented via `setTimeout` inside a `useEffect` with cleanup on unmount or query/mode change.