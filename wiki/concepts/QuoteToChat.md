---
title: "QuoteToChat"
type: concept
tags: [frontend, pattern, chat]
sources: [chatsearchpanel-search-panel-component]
last_updated: 2026-05-14
---

**QuoteToChat** is a user interaction pattern where search results in a panel can be quoted/injected directly into a chat input. In [[ChatSearchPanel]], each result displays a hover-revealed "Quote" button that calls the `onQuote(excerpt)` callback, allowing users to quickly reference search findings in their ongoing conversation.