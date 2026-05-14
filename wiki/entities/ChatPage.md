---
title: "ChatPage"
type: entity
tags: [component, page, chat, react, lazy]
sources: [router-configuration]
last_updated: 2026-05-14
---

**ChatPage** is the chat interface page in the [[LLMWikiViewer|LLM Wiki Viewer]] frontend. It is lazy-loaded for performance.

- Defined in `@/components/pages/ChatPage`
- Routed at `/chat/:sessionId` in [[router-configuration|Router Configuration]]
- The legacy `/chat` path redirects to `/search`