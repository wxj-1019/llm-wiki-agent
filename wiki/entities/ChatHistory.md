---
title: "ChatHistory"
type: entity
tags: [session, persistence, storage, chat, messages]
sources: [ChatPage.md, chatpage-chat-interface-component.md]
---

# ChatHistory

ChatHistory refers to the persistent record of all messages exchanged within a chat session in the [[LLMWikiViewer]]'s [[ChatPage]] component. It is stored and managed through [[LocalStorage]], enabling sessions to be preserved across page reloads and browser restarts. Each chat session maintains its own ChatHistory, which includes user messages, AI responses, system messages, and associated metadata such as timestamps and message roles. The ChatHistory is central to session management—users can create new sessions, switch between them, or delete them, and the ChatPage supports search and find-in-page functionality over the history. Additionally, the ChatHistory is referenced by features like [[@mention]] page references, slash commands, and summarization, which may draw on prior context. The active session's ChatHistory is also used to determine whether a chat is new or resuming, and it may be truncated or trimmed to manage token limits during streaming.