---
title: "ScrollToBottom"
type: concept
tags: [frontend, ui, chat]
sources: [chatconversation-chat-message-list-component]
last_updated: 2026-05-14
---

# ScrollToBottom

**ScrollToBottom** is a common UI pattern in chat and feed interfaces where a floating button appears when the user has scrolled up away from the bottom of the content. Clicking it smoothly scrolls the container to the most recent content. This is especially useful when new messages arrive while the user is reading earlier history.

In the [[ChatPage]] component, [[ChatConversation]] renders a floating button (using the [[Lucide|Lucide React]] ArrowDown icon) positioned at the bottom center of the scroll container. It is conditionally visible via the `showScrollToBottom` prop and calls `onScrollToBottom` on click.

## Related
- [[ChatConversation]] — implements scroll-to-bottom button
- [[ChatPage]] — parent that manages scroll state and callbacks
- [[Lucide]] — icon library providing the arrow icon