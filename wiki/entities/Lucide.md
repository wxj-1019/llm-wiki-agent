---
title: "Lucide"
type: entity
tags: [icons, ui, frontend, library]
sources: [ChatConversation.md, ChatInput.md, Header.md, LanguageSwitcher.md, chatconversation-chat-message-list-component.md, chathistory-chat-session-sidebar-component.md, chatinput-chat-input-component.md, root-layout-main-application-layout-component.md]
---

# Lucide

**Lucide** is an open-source icon library for React (imported as `lucide-react`) used throughout the [[LLMWikiViewer]] frontend to provide consistent, lightweight UI icons. It appears in components such as [[ChatHistory]], where it supplies icons for session management and sidebar controls; [[LanguageSwitcher]], where a [[Globe]] icon is used for the language selector; [[Header]], for navigation and status indicators; [[ChatInput]], for toolbar actions like search, summarization, and the send/stop button; and [[RootLayout]], for scroll-to-top and other interface elements. Lucide replaces older icon sets as a modern, tree-shakable alternative, ensuring that only the specific icons used in the application are bundled. Its icons are typically imported as named React components and are small, clear, and accessibility-friendly, making it a foundational dependency for the application's user interface.