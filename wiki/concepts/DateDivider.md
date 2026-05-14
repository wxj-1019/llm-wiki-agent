---
title: "DateDivider"
type: concept
tags: [frontend, ui, chat]
sources: [chatconversation-chat-message-list-component]
last_updated: 2026-05-14
---

# DateDivider

A **DateDivider** is a visual separator in a conversation or feed UI that indicates when messages transition from one calendar day to the next. It typically displays "Today", "Yesterday", or a localized date string (e.g., "May 14") centered between two horizontal lines.

In the [[ChatPage]] component, [[ChatConversation]] implements date dividers between consecutive messages that have different dates (based on the `timestamp` field). The label is computed by `formatDateDivider()` using [[i18next]] for translation.

## Related
- [[ChatConversation]] — implements date dividers
- [[i18next]] — used for localizing "Today" / "Yesterday" / date format