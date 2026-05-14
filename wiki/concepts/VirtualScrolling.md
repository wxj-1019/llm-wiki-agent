---
title: "VirtualScrolling"
type: concept
tags: [frontend, react, performance]
sources: [chatconversation-chat-message-list-component]
last_updated: 2026-05-14
---

# VirtualScrolling

**VirtualScrolling** (also known as windowed rendering) is a performance optimization technique where only a subset of items in a large list are rendered in the DOM at any given time. The component calculates which items are visible (or about to become visible) and only inserts those DOM nodes, dramatically reducing memory usage and layout cost for long lists.

In the [[ChatPage]] component, [[ChatConversation]] implements virtual scrolling via a `renderWindow` prop. When the number of entries exceeds this window, only the last `renderWindow` entries are rendered. A count banner shows how many earlier messages are collapsed.

## Related
- [[ChatConversation]] — uses virtual scrolling for chat history
- [[LazyLoading]] — another optimization pattern for deferred rendering