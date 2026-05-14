---
title: "MentionSystem"
type: concept
tags: [chat, search, UX]
sources: [chatpage-chat-interface-component]
---

**@mention system** is a chat interface pattern where typing `@` triggers an inline search and autocomplete for referencing wiki pages. In [[ChatPage]], typing `@` opens a dropdown of [[WikiSearchResult]] items. The user can navigate with arrow keys or click to select, which inserts a `[[PageName]]` wikilink into the message input. This bridges the [[ChatPage]] and wiki knowledge base, enabling precise source citation in chat queries.

Related: [[SSEStreamProtocol]], [[WikiSearchResult]], [[ChatPage]]